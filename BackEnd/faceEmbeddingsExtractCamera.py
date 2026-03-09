import cv2
import numpy as np
from insightface.app import FaceAnalysis

# Initialize the FaceAnalysis app with GPU support
app = FaceAnalysis(name="buffalo_l", providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# Open the webcam (0 is usually the default camera)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

print("Instructions:")
print("1. Look at the camera.")
print("2. Press 's' to SAVE the embedding.")
print("3. Press 'q' to QUIT.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    # Display instructions on the video feed
    display_frame = frame.copy()
    cv2.putText(display_frame, "Press 's' to Save Face, 'q' to Quit", (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    
    cv2.imshow("Generate Embedding", display_frame)

    key = cv2.waitKey(1) & 0xFF

    # If user presses 's', try to detect and save
    if key == ord('s'):
        print("Detecting face...")
        faces = app.get(frame)

        if len(faces) == 0:
            print("❌ No face detected! Please move closer or check lighting.")
        elif len(faces) > 1:
            print("⚠️ Multiple faces detected! Make sure only YOU are in the frame.")
        else:
            # Success: Get the embedding and save it
            target_embedding = faces[0].embedding
            np.save("ali.npy", target_embedding)
            print("✅ Success! 'ali.npy' has been created.")
            
            # Optional: Draw a box around the detected face just to show it worked
            bbox = faces[0].bbox.astype(int)
            cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), (0, 255, 0), 2)
            cv2.imshow("Generate Embedding", frame)
            cv2.waitKey(1000) # Pause for 1 second to show the box
            break

    # If user presses 'q', quit
    elif key == ord('q'):
        print("Quitting without saving.")
        break

cap.release()
cv2.destroyAllWindows()