from insightface.app import FaceAnalysis
import cv2
import numpy as np
import time
import os

# ==========================================
# 1. SETUP
# ==========================================
print("Initializing AI Model...")
app = FaceAnalysis(name="buffalo_l", providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(1280, 1280))
app.det_model.det_thresh = 0.3

DB_FILE = "face_db.npy"
if not os.path.exists(DB_FILE):
    print(f"❌ Error: '{DB_FILE}' not found.")
    exit()

known_faces = np.load(DB_FILE, allow_pickle=True).tolist()
print(f"✅ Database loaded. Tracking {len(known_faces)} people.")

# ==========================================
# 2. DEBUG SETUP
# ==========================================
MEDIA_FOLDER = "media"
DEBUG_FOLDER = "debug_frames"

if not os.path.exists(DEBUG_FOLDER):
    os.makedirs(DEBUG_FOLDER)
    print(f"📂 Created '{DEBUG_FOLDER}' for saving failed detections.")

video_list = []
if os.path.exists(MEDIA_FOLDER):
    for file in os.listdir(MEDIA_FOLDER):
        if file.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
            video_list.append(os.path.join(MEDIA_FOLDER, file))

if not video_list:
    print(f"❌ No videos found in '{MEDIA_FOLDER}'.")
    exit()

# ==========================================
# 3. PROCESSING LOOP
# ==========================================
SIMILARITY_THRESHOLD = 0.35 

for video_path in video_list:
    filename = os.path.basename(video_path)
    print(f"\n▶️ Analyzing: {filename}")
    
    cap = cv2.VideoCapture(video_path)
    frame_count = 0
    saved_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        
        # Process every 5th frame to save time/space
        if frame_count % 5 != 0:
            continue

        faces = app.get(frame)

        for face in faces:
            embedding = face.embedding
            max_similarity = 0
            best_match = None

            for person in known_faces:
                sim = np.dot(embedding, person['embedding']) / (
                    np.linalg.norm(embedding) * np.linalg.norm(person['embedding'])
                )
                if sim > max_similarity:
                    max_similarity = sim
                    best_match = person

            # --- CAPTURE LOGIC ---
            # If the score is between 0.15 (too low) and 0.40 (good match)
            # This is the "CONFUSION ZONE" we need to see.
            if 0.15 < max_similarity < 0.40:
                bbox = face.bbox.astype(int)
                
                # Draw what the AI sees
                debug_img = frame.copy()
                cv2.rectangle(debug_img, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 0, 255), 2)
                cv2.putText(debug_img, f"Score: {max_similarity:.2f}", (bbox[0], bbox[1]-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                
                # Save Frame
                img_name = f"fail_{filename}_{frame_count}_score_{max_similarity:.2f}.jpg"
                save_path = os.path.join(DEBUG_FOLDER, img_name)
                cv2.imwrite(save_path, debug_img)
                saved_count += 1
                print(f"   📸 Captured weak detection: {max_similarity:.2f}")

    cap.release()

print(f"\n✅ Analysis Complete. Check the '{DEBUG_FOLDER}' folder.")
print(f"   If you see your face in those images, upload 1 or 2 of them here.")