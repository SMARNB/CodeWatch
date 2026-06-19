import cv2
import os
import sys

# ==========================================
# SETUP
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_FOLDER = os.path.join(BASE_DIR, "media")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "output_videos")

# explicit filename for testing
INPUT_FILENAME = "1.mp4" 
INPUT_PATH = os.path.join(MEDIA_FOLDER, INPUT_FILENAME)
OUTPUT_PATH = os.path.join(OUTPUT_FOLDER, "debug_test.avi")

print(f"--- DEBUGGING VIDEO I/O ---")
print(f"Reading from: {INPUT_PATH}")

if not os.path.exists(INPUT_PATH):
    print(f"❌ ERROR: Could not find '{INPUT_FILENAME}'. Please rename your video file!")
    sys.exit()

if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

# ==========================================
# VIDEO TEST
# ==========================================
cap = cv2.VideoCapture(INPUT_PATH)

if not cap.isOpened():
    print("❌ ERROR: OpenCV cannot open the video file.")
    sys.exit()

width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
fps = cap.get(cv2.CAP_PROP_FPS)

print(f"✅ Video Opened. Resolution: {width}x{height} | FPS: {fps}")

# Force MJPG Codec (Safest for Windows)
fourcc = cv2.VideoWriter_fourcc(*'MJPG')
out = cv2.VideoWriter(OUTPUT_PATH, fourcc, fps, (width, height))

if not out.isOpened():
    print("❌ ERROR: VideoWriter failed to initialize.")
    sys.exit()

print("▶️ Writing 100 frames as a test...")

count = 0
while True:
    ret, frame = cap.read()
    if not ret:
        print("End of video reached.")
        break
    
    # Draw a simple box to prove it's processing
    cv2.rectangle(frame, (50, 50), (200, 200), (0, 0, 255), 5)
    cv2.putText(frame, f"Frame: {count}", (60, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    out.write(frame)
    
    # Try to show window
    try:
        cv2.imshow("Debug Test", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    except Exception as e:
        print("⚠️ Display error (ignoring):", e)
        
    count += 1
    if count >= 100: # Stop after 100 frames for quick test
        break

cap.release()
out.release()
cv2.destroyAllWindows()

print(f"✅ DONE. Check output file: {OUTPUT_PATH}")
print("If this file plays in VLC, your OpenCV is fine.")