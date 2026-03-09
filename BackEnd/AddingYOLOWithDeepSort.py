import cv2
import time
import numpy as np
import torch # Imported to check for CUDA availability if needed
from deep_sort_realtime.deepsort_tracker import DeepSort
from insightface.app import FaceAnalysis
from ultralytics import YOLO

# ---------------------------
# 0. Settings
# ---------------------------
VIDEO_PATH = "2.mp4"
#VIDEO_PATH = "XVR.dav"
YOLO_MODEL_PATH = "runs/segment/train4/weights/best.pt"
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
YOLO_CONF = 0.4

# ---------------------------
# 1. Load YOLO person detector
# ---------------------------
# Load the model. It will automatically use the GPU if available, 
# but we will force device=0 in the inference loop to be sure.
model = YOLO(YOLO_MODEL_PATH)

# ---------------------------
# 2. Load InsightFace
# ---------------------------
# CHANGED: Switched to CUDAExecutionProvider for NVIDIA GPU support.
# If you get errors here, ensure 'onnxruntime-gpu' is installed.
app = FaceAnalysis(providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# ---------------------------------
# 3. DeepSORT for person tracking
# ---------------------------------
# CHANGED: Added embedder_gpu=True to run the feature extractor on the GPU.
tracker = DeepSort(
    max_age=600,
    n_init=1,
    nms_max_overlap=1.0,
    max_cosine_distance=0.5,
    embedder='mobilenet',
    embedder_gpu=True,  # <--- Forces the embedder to run on GPU
    half=True,
    bgr=True
)

known_identities = {}   # track_id -> embedding vector
total_person = 0

# ---------------------------
# 4. Video Init
# ---------------------------
cap = cv2.VideoCapture(VIDEO_PATH)
if not cap.isOpened():
    raise IOError(f"Cannot open video {VIDEO_PATH}")

fps_time = time.time()
frame_count = 0

print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Using GPU: {torch.cuda.get_device_name(0)}")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
    original_frame = frame.copy()

    # ---------------------------
    # A) Run YOLO on the frame
    # ---------------------------
    # CHANGED: changed device="cpu" to device=0 (GPU 0)
    results = model(frame, conf=YOLO_CONF, device=0, imgsz=max(FRAME_WIDTH, FRAME_HEIGHT), classes=3, verbose=False)
    detections_for_tracker = []

    if len(results) > 0:
        r = results[0]
        for i, box in enumerate(r.boxes):
            # Move data to CPU explicitly for numpy conversion
            xyxy = box.xyxy[0].cpu().numpy()
            x1, y1, x2, y2 = map(int, xyxy)
            conf = float(box.conf[0].cpu().numpy())
            cls = int(box.cls[0].cpu().numpy())

            w = x2 - x1
            h = y2 - y1

            detections_for_tracker.append(([x1, y1, w, h], conf, "person"))

            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 150, 0), 2)
            label = f"YOLO: {conf:.2f}"
            cv2.putText(frame, label, (x1, max(15, y1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 150, 0), 1)

    # ---------------------------
    # B) Update DeepSort with YOLO detections
    # ---------------------------
    tracks = tracker.update_tracks(detections_for_tracker, frame=original_frame)

    # ---------------------------
    # C) Iterate tracks
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
                except Exception as e:
                    crop_rgb = crop

                # InsightFace app.get() runs on GPU via CUDA provider
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
        # Print FPS to console to verify speedup
        print(f"FPS: {fps:.2f}") 
        
    # Recalculate FPS for display (reuse the console calculation generally, 
    # but strictly speaking we just display the last calculated FPS here)
    cv2.putText(frame, f"FPS: {fps:.1f}" if 'fps' in locals() else "FPS: --", (10, 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

    cv2.imshow("YOLO + DeepSORT + InsightFace (GPU)", frame)
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()