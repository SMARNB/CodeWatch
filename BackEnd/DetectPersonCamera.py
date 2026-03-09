import cv2
import numpy as np
import time
import os
from insightface.app import FaceAnalysis

# 1. SETUP INSIGHTFACE WITH GPU (RTX 3060)
# 'allowed_modules' is removed so it detects AND recognizes faces
app = FaceAnalysis(name="buffalo_l", providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# 2. LOAD TARGET EMBEDDING
embedding_file = "ali.npy"
if not os.path.exists(embedding_file):
    print(f"Error: '{embedding_file}' not found.")
    print("Please run 'GenerateEmbedding.py' first to create your face profile.")
    exit()

target_embedding = np.load(embedding_file)
SIMILARITY_THRESHOLD = 0.4  # Adjust this (0.4 - 0.6 is usually good)

# 3. OPEN WEBCAM
# Use 0 for default laptop camera, 1 for external USB camera
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

# Set resolution (Optional: 640x480 is standard and fast)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

print("Starting Video... Press 'q' to Exit.")
prev_time = time.time()

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    # 4. INFERENCE
    # Detect faces and extract embeddings
    faces = app.get(frame)

    for face in faces:
        embedding = face.embedding

        # Calculate Cosine Similarity
        # (A . B) / (|A| * |B|)
        cosine_sim = np.dot(embedding, target_embedding) / (
            np.linalg.norm(embedding) * np.linalg.norm(target_embedding)
        )

        # Draw Bounding Box
        bbox = face.bbox.astype(int)
        
        if cosine_sim > SIMILARITY_THRESHOLD:
            # MATCH FOUND (Green Box)
            color = (0, 255, 0)
            label = f"Ali ({cosine_sim:.2f})"
        else:
            # UNKNOWN PERSON (Red Box)
            color = (0, 0, 255)
            label = f"Unknown ({cosine_sim:.2f})"

        cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
        cv2.putText(frame, label, (bbox[0], bbox[1]-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    # 5. CALCULATE FPS
    curr_time = time.time()
    fps = 1 / (curr_time - prev_time)
    prev_time = curr_time
    
    cv2.putText(frame, f"FPS: {fps:.2f}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

    # Show result
    cv2.imshow("Real-Time Detection", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()