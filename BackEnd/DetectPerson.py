from insightface.app import FaceAnalysis
import cv2
import numpy as np
import time

# We removed 'allowed_modules' so it loads both Detection and Recognition
# We changed the provider to CUDA for your RTX 3060
app = FaceAnalysis(name="buffalo_l", providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

target_embedding = np.load("ali.npy")


video_path = "aliVid1.mp4"
cap = cv2.VideoCapture(video_path)

prev_time = time.time()

while True:
    ret, frame = cap.read()
    frame = cv2.resize(frame, (320,320))
    if not ret:
        break

    # Detect faces and get embeddings
    faces = app.get(frame)

    for face in faces:
        embedding = face.embedding  

        cosine_sim = np.dot(embedding, target_embedding) / (
            np.linalg.norm(embedding) * np.linalg.norm(target_embedding)
        )
        if cosine_sim > 0.3: 
            bbox = face.bbox.astype(int)
            cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 255, 0), 2)
            cv2.putText(frame, "Target Person", (bbox[0], bbox[1]-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

    curr_time = time.time()
    fps = 1 / (curr_time - prev_time)
    prev_time = curr_time
    cv2.putText(frame, f"FPS: {fps:.2f}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)


    cv2.imshow("Video", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
