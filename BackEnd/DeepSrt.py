import cv2
import time
import numpy as np
from deep_sort_realtime.deepsort_tracker import DeepSort
from insightface.app import FaceAnalysis
from ultralytics import YOLO
import os

# ---------------------------
# 0. Settings
# ---------------------------
VIDEO_DIR = "media"  # Point this to your folder
VALID_EXTS = {".mp4", ".dav", ".avi", ".mkv", ".mov"}

# Automatically get all video files from the directory
VIDEO_PATHS = [
    os.path.join(VIDEO_DIR, f) 
    for f in os.listdir(VIDEO_DIR) 
    if os.path.splitext(f)[1].lower() in VALID_EXTS
]

# Optional: Sort files alphabetically so they play in order
VIDEO_PATHS.sort()

YOLO_MODEL_PATH = "runs/segment/train5/weights/best.pt"
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
YOLO_CONF = 0.4

# ---------------------------
# 1. Load YOLO person detector
# ---------------------------
model = YOLO(YOLO_MODEL_PATH)  # model should support 'person' class as class 0

# ---------------------------
# 2. Load InsightFace
# ---------------------------
# Switched to CUDAExecutionProvider for NVIDIA GPU support
app = FaceAnalysis(providers=['CUDAExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# ---------------------------------
# 3. DeepSORT for person tracking
# ---------------------------------
tracker = DeepSort(
    max_age=180,
    n_init=1,
    nms_max_overlap=1.0,
    max_cosine_distance=0.5,
    embedder='mobilenet',
    half=True,
    bgr=True,
    embedder_gpu=True
)

# storage for identity embeddings
known_identities = {}
total_person = 0

# ---------------------------
# 4. Video Loop
# ---------------------------
stop_program = False  # Flag to exit all videos if 'q' is pressed

for video_path in VIDEO_PATHS:
    if stop_program:
        break

    print(f"Processing video: {video_path}")
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Cannot open video {video_path}")
        continue

    # optional: FPS measurement
    fps_time = time.time()
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print(f"Finished video: {video_path}")
            break

        # Resize frame for consistent processing and display
        frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
        original_frame = frame.copy()

        # ---------------------------
        # A) Run YOLO on the frame
        # ---------------------------
        results = model(frame, conf=YOLO_CONF, device="cuda", imgsz=max(FRAME_WIDTH, FRAME_HEIGHT), classes=3)
        detections_for_tracker = []

        if len(results) > 0:
            r = results[0]
            for i, box in enumerate(r.boxes):
                xyxy = box.xyxy[0].cpu().numpy() if hasattr(box.xyxy, "cpu") else box.xyxy[0].numpy()
                x1, y1, x2, y2 = map(int, xyxy)
                conf = float(box.conf[0]) if hasattr(box.conf, "__len__") else float(box.conf)
                
                w = x2 - x1
                h = y2 - y1

                detections_for_tracker.append(([x1, y1, w, h], conf, "person"))

                # draw YOLO box (blue)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 150, 0), 2)
                label = f"YOLO: {conf:.2f}"
                cv2.putText(frame, label, (x1, max(15, y1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 150, 0), 1)

        # ---------------------------
        # B) Update DeepSort with YOLO detections
        # ---------------------------
        tracks = tracker.update_tracks(detections_for_tracker, frame=original_frame)

        # ---------------------------
        # C) Iterate tracks, draw boxes & face recognition
        # ---------------------------
        for track in tracks:
            if not track.is_confirmed():
                continue

            track_id = track.track_id
            l, t, r, b = track.to_ltrb()
            x1, y1, x2, y2 = map(int, [l, t, r, b])

            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(FRAME_WIDTH - 1, x2)
            y2 = min(FRAME_HEIGHT - 1, y2)

            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 0), 2)

            name_text = f"ID {track_id}"
            if track_id not in known_identities:
                if (x2 - x1) > 20 and (y2 - y1) > 20:
                    crop = original_frame[y1:y2, x1:x2]
                    try:
                        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                    except:
                        crop_rgb = crop

                    faces = app.get(crop_rgb)
                    if faces and len(faces) > 0:
                        best = max(faces, key=lambda f: f.det_score)
                        emb = best.embedding
                        known_identities[track_id] = emb
                        name_text = f"ID {track_id} (face)"
                    else:
                        known_identities[track_id] = None
                        name_text = f"ID {track_id} (no face)"
                else:
                    known_identities[track_id] = None
                    name_text = f"ID {track_id} (small)"
            else:
                if known_identities[track_id] is not None:
                    name_text = f"ID {track_id} (face)"
                else:
                    name_text = f"ID {track_id}"

            cv2.putText(frame, name_text, (x1, max(12, y1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 220, 0), 2)

        # ---------------------------
        # D) Show FPS and frame
        # ---------------------------
        frame_count += 1
        if frame_count % 10 == 0:
            now = time.time()
            fps = 10.0 / (now - fps_time)
            fps_time = now
            cv2.putText(frame, f"FPS: {fps:.1f}", (10, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        cv2.imshow("YOLO + DeepSORT + InsightFace", frame)
        
        # Press 'q' to stop everything
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            stop_program = True
            break

    cap.release()

cv2.destroyAllWindows()