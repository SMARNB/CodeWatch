from roboflow import Roboflow
import supervision as sv
import cv2
import os

# Initialize Roboflow model
rf = Roboflow(api_key="JKGWfwmWAUOHgIZ6ZwW7")
project = rf.workspace().project("hard_hat_detector_seg")
model = project.version(2).model

# Video file in same directory
video_path = "XVR_ch12_main_20250418092437_20250418100008.dav"
cap = cv2.VideoCapture(video_path)

# Check if video was opened successfully
if not cap.isOpened():
    print("Error: Could not open video file.")
    exit()

# Optional: Save output video
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter('output_video.mp4', fourcc, 20.0,
                      (int(cap.get(3)), int(cap.get(4))))

# Initialize annotators
label_annotator = sv.LabelAnnotator()
mask_annotator = sv.MaskAnnotator()

frame_count = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_count += 1

    # Resize frame to 640x480 for prediction (optional)
    resized_frame = cv2.resize(frame, (640, 480))

    # Save temporary frame as image
    temp_image_path = "temp_frame.jpg"
    cv2.imwrite(temp_image_path, resized_frame)

    # Run prediction
    result = model.predict(temp_image_path, confidence=40).json()

    # Process results
    detections = sv.Detections.from_roboflow(result)
    labels = [item["class"] for item in result["predictions"]]

    # Annotate image
    annotated_frame = mask_annotator.annotate(
        scene=resized_frame.copy(), detections=detections)
    annotated_frame = label_annotator.annotate(
        scene=annotated_frame, detections=detections, labels=labels)

    # Show result
    cv2.imshow("Roboflow Detection", annotated_frame)
    out.write(annotated_frame)

    # Exit on 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release everything
cap.release()
out.release()
cv2.destroyAllWindows()

# Clean up temporary file
if os.path.exists("temp_frame.jpg"):
    os.remove("temp_frame.jpg")
