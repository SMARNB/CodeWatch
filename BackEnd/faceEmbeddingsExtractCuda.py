import cv2
import numpy as np
import os
from insightface.app import FaceAnalysis

# ==========================================
# 1. SETUP
# ==========================================
print("Initializing AI Model on GPU...")
app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

DB_FILE = "face_db.npy"
SAMPLES_FOLDER = "training_samples" # Folder to save verification images
known_faces = [] 

# Create the samples folder if it doesn't exist
if not os.path.exists(SAMPLES_FOLDER):
    os.makedirs(SAMPLES_FOLDER)
    print(f"📂 Created '{SAMPLES_FOLDER}' for visual verification.")
else:
    # Optional: Clear old samples to avoid clutter
    for f in os.listdir(SAMPLES_FOLDER):
        os.remove(os.path.join(SAMPLES_FOLDER, f))
    print(f"🧹 Cleared old files in '{SAMPLES_FOLDER}'.")

# ==========================================
# 2. PROCESSING FUNCTION
# ==========================================
def process_image(image_path, name, gender, status):
    if not os.path.exists(image_path):
        print(f"❌ Skipped (Not found): {image_path}")
        return

    img = cv2.imread(image_path)
    if img is None:
        print(f"❌ Skipped (Read Error): {image_path}")
        return

    # Detect Face
    faces = app.get(img)
    
    if len(faces) == 0:
        print(f"⚠️ No face detected in {os.path.basename(image_path)}")
        return
    
    # Use the largest face found
    main_face = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
    new_embedding = main_face.embedding

    # --- SAVE TRAINING SAMPLE ---
    # Crop the face and save it so you can check quality later
    bbox = main_face.bbox.astype(int)
    # Add some padding to the crop
    h, w, _ = img.shape
    x1 = max(0, bbox[0] - 20)
    y1 = max(0, bbox[1] - 20)
    x2 = min(w, bbox[2] + 20)
    y2 = min(h, bbox[3] + 20)
    
    face_crop = img[y1:y2, x1:x2]
    
    # Create a unique filename for the sample
    sample_filename = f"{name}_{os.path.basename(image_path)}"
    cv2.imwrite(os.path.join(SAMPLES_FOLDER, sample_filename), face_crop)
    # ---------------------------

    # FORCE MERGE LOGIC
    found = False
    for person in known_faces:
        if person['name'].lower() == name.lower():
            # Merge
            old_embedding = person['embedding']
            count = person['count']
            
            # Weighted Average
            merged = (old_embedding * count + new_embedding) / (count + 1)
            merged /= np.linalg.norm(merged)
            
            person['embedding'] = merged
            person['count'] += 1
            
            sim = np.dot(new_embedding, old_embedding) / (
                np.linalg.norm(new_embedding) * np.linalg.norm(old_embedding)
            )
            
            print(f"🔄 Merged: {os.path.basename(image_path)} (Sim: {sim:.2f})")
            found = True
            break
    
    if not found:
        # Create New Profile
        person_data = {
            "name": name,
            "gender": gender,
            "status": status,
            "embedding": new_embedding,
            "count": 1
        }
        known_faces.append(person_data)
        print(f"✅ Created Profile: {name} (Base: {os.path.basename(image_path)})")

# ==========================================
# 3. SCAN FOLDER
# ==========================================
FACES_FOLDER = "faces"
VALID_EXTENSIONS = ('.jpg', '.jpeg', '.png')

if not os.path.exists(FACES_FOLDER):
    os.makedirs(FACES_FOLDER)
    print(f"Created '{FACES_FOLDER}' folder.")
else:
    print(f"📂 Scanning '{FACES_FOLDER}'...")
    
    files = sorted([f for f in os.listdir(FACES_FOLDER) if f.lower().endswith(VALID_EXTENSIONS)])
    
    if not files:
        print("❌ No images found in 'faces' folder!")
    
    for filename in files:
        path = os.path.join(FACES_FOLDER, filename)
        process_image(path, name="Ali", gender="M", status="Student")

# ==========================================
# 4. SAVE
# ==========================================
if known_faces:
    np.save(DB_FILE, known_faces)
    print(f"\n💾 Database Saved. Profiles: {len(known_faces)}")
    print(f"   Check '{SAMPLES_FOLDER}' to see exactly what faces were learned.")
else:
    print("\n❌ Database NOT saved.")