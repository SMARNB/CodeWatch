import cv2
import time
import numpy as np
from deep_sort_realtime.deepsort_tracker import DeepSort
from insightface.app import FaceAnalysis

# --- 1. SETUP INSIGHTFACE (Detector + Embedder) ---
# We use CUDA for speed. This runs on your RTX GPU.
app = FaceAnalysis(providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# --- 2. SETUP DEEPSORT ---
# embedder=None means "I will provide the embeddings myself"
tracker = DeepSort(max_age=30, n_init=2, embedder=None) 

# --- 3. VIDEO CAPTURE ---
# Change to 0 for webcam, or "video.mp4" for a file
cap = cv2.VideoCapture("video.mp4") 

prev_frame_time = 0
new_frame_time = 0

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    # --- 4. DETECT FACES (InsightFace) ---
    faces = app.get(frame)
    
    # Prepare the list for DeepSort
    # Format MUST be: [[left, top, w, h], confidence, class_id, embedding]
    detections = []
    
    for face in faces:
        # Convert bbox from [x1, y1, x2, y2] to [x, y, w, h]
        bbox = face.bbox.astype(int)
        x, y = int(bbox[0]), int(bbox[1])
        w, h = int(bbox[2] - bbox[0]), int(bbox[3] - bbox[1])
        
        # Convert confidence to standard float
        conf = float(face.det_score)
        
        # Get the embedding (the "Face ID" data)
        embedding = face.embedding

        # Append to list - CRITICAL: Must have 4 items!
        detections.append(([x, y, w, h], conf, 'person', embedding))

    # --- 5. UPDATE TRACKER ---
    # Only run tracker if we actually found faces
    tracks = []
    if len(detections) > 0:
        tracks = tracker.update_tracks(detections, frame=frame)

    # --- 6. DRAW TRACKS ---
    for track in tracks:
        if not track.is_confirmed():
            continue
            
        track_id = track.track_id
        ltrb = track.to_ltrb()
        
        # Draw bounding box
        cv2.rectangle(frame, (int(ltrb[0]), int(ltrb[1])), (int(ltrb[2]), int(ltrb[3])), (0, 255, 0), 2)
        # Draw ID
        cv2.putText(frame, "ID: " + str(track_id), (int(ltrb[0]), int(ltrb[1]) - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)

    # --- 7. CALCULATE & SHOW FPS ---
    new_frame_time = time.time()
    # Avoid division by zero
    time_diff = new_frame_time - prev_frame_time
    if time_diff > 0:
        fps = 1 / time_diff
    else:
        fps = 0
    prev_frame_time = new_frame_time
    
    cv2.putText(frame, f"FPS: {int(fps)}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

    cv2.imshow("InsightFace + DeepSort (CUDA)", frame)
    
    # Press 'q' to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()