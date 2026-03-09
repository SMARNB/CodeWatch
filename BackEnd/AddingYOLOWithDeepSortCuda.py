import cv2
import time
import numpy as np
import torch
import os
from deep_sort_realtime.deepsort_tracker import DeepSort
from insightface.app import FaceAnalysis
from ultralytics import YOLO

# ---------------------------
# 0. Settings
# ---------------------------
MEDIA_FOLDER = "media"
# YOLO_MODEL_PATH = "C:\Users\alira\OneDrive\Documents\FYP\BackEnd\runs\segment\train4\weights\best.pt"
YOLO_MODEL_PATH = r"runs/segment/train4/weights/best.pt"
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
YOLO_CONF = 0.4
FACE_MATCH_THRESHOLD = 0.5  # Cosine similarity threshold (0.5 is usually good for InsightFace)

# ---------------------------
# 1. Global Identity Registry
# ---------------------------
# Stores: { global_id: embedding_vector }
global_registry = {}
next_global_id = 1

def find_best_match(new_embedding, registry, threshold=0.5):
    """
    Compares new_embedding with all embeddings in registry.
    Returns (best_id, score) if score > threshold, else (None, score).
    """
    best_score = -1.0
    best_id = None

    # Normalize new embedding for cosine similarity
    norm_new = np.linalg.norm(new_embedding)
    if norm_new == 0: return None, 0.0
    
    for g_id, g_emb in registry.items():
        norm_g = np.linalg.norm(g_emb)
        if norm_g == 0: continue
        
        # Cosine Similarity: (A . B) / (|A| * |B|)
        score = np.dot(new_embedding, g_emb) / (norm_new * norm_g)
        
        if score > best_score:
            best_score = score
            best_id = g_id
            
    if best_score > threshold:
        return best_id, best_score
    return None, best_score

# ---------------------------
# 2. Load Resources
# ---------------------------
print("Loading YOLO model...")
model = YOLO(YOLO_MODEL_PATH)

print("Loading InsightFace...")
app = FaceAnalysis(providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# ---------------------------
# 3. Prepare Video Sources
# ---------------------------
video_sources = []
if os.path.exists(MEDIA_FOLDER):
    supported_ext = ('.mp4', '.dav', '.avi', '.mkv', '.mov')
    for file in os.listdir(MEDIA_FOLDER):
        if file.lower().endswith(supported_ext):
            video_sources.append(os.path.join(MEDIA_FOLDER, file))
    print(f"Found {len(video_sources)} video(s).")
else:
    print("Media folder not found.")
    exit()

# ---------------------------
# 4. Main Processing Loop
# ---------------------------
for source in video_sources:
    print(f"\n--- Processing: {source} ---")

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        continue

    # ---------------------------
    # Tracker Config (Resets per video)
    # ---------------------------
    # We still calculate dynamic max_age for smooth tracking WITHIN the video
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps != fps and fps <= 0: fps = 30
    max_age_val = int(fps * 20) # 20 seconds retention (internal tracker)

    tracker = DeepSort(
        max_age=max_age_val,
        n_init=1,
        nms_max_overlap=1.0,
        max_cosine_distance=0.5,
        embedder='mobilenet',
        embedder_gpu=True,
        half=True,
        bgr=True
    )
    
    # Maps local DeepSORT track_id -> Global Persistent ID
    # This resets per video, but the IDs inside come from global_registry
    local_to_global_map = {} 
    
    fps_time = time.time()
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
        original_frame = frame.copy()

        # A) YOLO Detection
        results = model(frame, conf=YOLO_CONF, device=0, imgsz=max(FRAME_WIDTH, FRAME_HEIGHT), classes=3, verbose=False)
        detections = []
        if len(results) > 0:
            for box in results[0].boxes:
                xyxy = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)
                conf = float(box.conf[0].cpu().numpy())
                detections.append(([x1, y1, x2-x1, y2-y1], conf, "person"))
                # Draw YOLO raw box (Thin Orange)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 150, 0), 1)

        # B) DeepSORT Update
        tracks = tracker.update_tracks(detections, frame=original_frame)

        # C) ID Resolution & Drawing
        for track in tracks:
            if not track.is_confirmed() or track.time_since_update > 1:
                continue

            track_id = track.track_id # This is the temporary ID (1, 2, 3...) for THIS video only
            l, t, r, b = track.to_ltrb()
            x1, y1, x2, y2 = map(int, [l, t, r, b])
            x1, y1, x2, y2 = max(0, x1), max(0, y1), min(FRAME_WIDTH, x2), min(FRAME_HEIGHT, y2)

            # Logic: Do we already know who this 'track_id' is globally?
            final_id = None
            status_text = ""

            if track_id in local_to_global_map:
                # Yes, we already matched this track to a Global ID
                final_id = local_to_global_map[track_id]
                status_text = f"ID {final_id}"
            else:
                # No, this is a new track (or re-entry) we haven't identified yet
                # Try to find a face
                if (x2 - x1) > 20 and (y2 - y1) > 20:
                    crop = original_frame[y1:y2, x1:x2]
                    try:
                        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                    except:
                        crop_rgb = crop
                    
                    faces = app.get(crop_rgb)
                    
                    if faces:
                        # Face Found!
                        best_face = max(faces, key=lambda f: f.det_score)
                        emb = best_face.embedding

                        # Check Global Registry
                        match_id, score = find_best_match(emb, global_registry, FACE_MATCH_THRESHOLD)
                        
                        if match_id is not None:
                            # RECOGNIZED: This is an old person coming back!
                            final_id = match_id
                            local_to_global_map[track_id] = final_id
                            # Optional: Update embedding to average? (Skipped for simplicity)
                            status_text = f"ID {final_id} (Match {score:.2f})"
                        else:
                            # NEW PERSON: Assign new Global ID
                            final_id = next_global_id
                            global_registry[final_id] = emb
                            local_to_global_map[track_id] = final_id
                            next_global_id += 1
                            status_text = f"ID {final_id} (New)"
                    else:
                        # No face visible yet
                        status_text = f"Scanning..."
                else:
                    status_text = "Scanning..."

            # Draw Box
            color = (0, 255, 0) if final_id is not None else (0, 0, 255) # Green if ID'd, Red if Scanning
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, status_text, (x1, max(12, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # D) FPS
        frame_count += 1
        if frame_count % 10 == 0:
            fps_disp = 10.0 / (time.time() - fps_time)
            fps_time = time.time()
            print(f"FPS: {fps_disp:.1f}")

        cv2.imshow("Global ID System", frame)
        key = cv2.waitKey(1)
        if key == ord('q'): exit()
        if key == ord('n'): break

    cap.release()
cv2.destroyAllWindows()