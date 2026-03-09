import cv2
import numpy as np
import os
import time
from insightface.app import FaceAnalysis

# ==========================================
# 1. SETUP AI (Standard CUDA)
# ==========================================
print("Initializing AI Model on GPU (CUDA)...")

# Using standard CUDA provider which is stable and fast
app = FaceAnalysis(name="buffalo_l", providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(1280, 1280)) # High resolution scan for accuracy
app.det_model.det_thresh = 0.25 # Lower detection threshold to find blurry faces

DB_FILE = "face_db.npy"
if not os.path.exists(DB_FILE):
    print(f"❌ Error: '{DB_FILE}' not found.")
    exit()

known_faces = np.load(DB_FILE, allow_pickle=True).tolist()
print(f"✅ Database loaded. Profiles: {len(known_faces)}")

# ==========================================
# 2. SETUP DIRECTORIES
# ==========================================
MEDIA_FOLDER = "media"
OUTPUT_FOLDER = "output_videos"

if not os.path.exists(MEDIA_FOLDER):
    print(f"❌ Error: '{MEDIA_FOLDER}' folder missing.")
    exit()

if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)
    print(f"📂 Created '{OUTPUT_FOLDER}' directory.")

video_files = [f for f in os.listdir(MEDIA_FOLDER) if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))]
if not video_files:
    print("❌ No videos found.")
    exit()

# THRESHOLDS
THRESH_CERTAIN = 0.50  # Green Box
THRESH_LIKELY  = 0.35  # Yellow Box
THRESH_WEAK    = 0.20  # Red/Orange Box

# ==========================================
# 3. MAIN BATCH LOOP
# ==========================================
print(f"🚀 Found {len(video_files)} videos. Starting batch processing...")

for i, filename in enumerate(video_files):
    input_path = os.path.join(MEDIA_FOLDER, filename)
    output_path = os.path.join(OUTPUT_FOLDER, f"processed_{filename}")
    
    print(f"\n▶️ Processing ({i+1}/{len(video_files)}): {filename}")
    
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"⚠️ Could not open {filename}. Skipping.")
        continue

    # Video Properties for Saving
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Video Writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break # End of video

        frame_count += 1

        # Resize Input for AI (Standardize size for detection)
        # AI works best on images around 640-1280px width.
        ai_frame = frame
        scale_factor = 1.0
        
        if frame.shape[1] > 1280:
            scale_factor = 1280 / frame.shape[1]
            ai_frame = cv2.resize(frame, (1280, int(frame.shape[0] * scale_factor)))
        
        faces = app.get(ai_frame)

        for face in faces:
            # Scale bbox back to original frame size
            if scale_factor != 1.0:
                face.bbox = face.bbox / scale_factor

            embedding = face.embedding
            max_sim = 0
            best_match = None

            for person in known_faces:
                sim = np.dot(embedding, person['embedding']) / (
                    np.linalg.norm(embedding) * np.linalg.norm(person['embedding'])
                )
                if sim > max_sim:
                    max_sim = sim
                    best_match = person

            bbox = face.bbox.astype(int)
            name = best_match['name'] if best_match else "Unknown"
            
            # Logic for Boxes
            if best_match:
                if max_sim > THRESH_CERTAIN:
                    color = (0, 255, 0) # Green
                    label = f"{name} ({max_sim:.2f})"
                    thickness = 2
                elif max_sim > THRESH_LIKELY:
                    color = (0, 255, 255) # Yellow
                    label = f"{name}? ({max_sim:.2f})"
                    thickness = 2
                elif max_sim > THRESH_WEAK:
                    color = (0, 165, 255) # Orange
                    label = f"Weak ({max_sim:.2f})"
                    thickness = 1
                else:
                    color = (0, 0, 255) # Red
                    label = "" 
                    thickness = 1
            else:
                color = (0, 0, 255)
                label = ""
                thickness = 1

            cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, thickness)
            if label:
                cv2.putText(frame, label, (bbox[0], bbox[1]-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # SAVE FRAME
        out.write(frame)

        # DISPLAY (Optional - Resize huge 4K frames for screen)
        display_frame = frame
        if frame.shape[1] > 1600:
            display_frame = cv2.resize(frame, (1280, 720))
            
        cv2.imshow("Processing Batch...", display_frame)
        
        # Press 'q' to quit ALL, 'n' to skip video
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            cap.release()
            out.release()
            cv2.destroyAllWindows()
            print("❌ Batch processing stopped by user.")
            exit()
        elif key == ord('n'):
            print("⏭️ Skipping to next video...")
            break

    cap.release()
    out.release()
    print(f"✅ Saved: {output_path}")

cv2.destroyAllWindows()
print("\n🎉 All videos processed!")