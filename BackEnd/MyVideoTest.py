import cv2
from ultralytics import YOLO
import time


def test_model_batch_24fps():
    """
    Processes video using batch inference and saves at 24 FPS.
    This method is highly efficient, especially on a GPU.
    """
    print("Starting batch processing for 24 FPS output...")
    model = YOLO("runs/segment/train5/weights/best.pt")

    cap = cv2.VideoCapture("2.mp4")
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Input video: Total Frames: {total_frames}, FPS: {fps}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # --- KEY CHANGE ---
    # Set the desired output FPS to 24
    target_fps = 24
    # ------------------

    # This logic now automatically calculates the correct frame sampling interval
    # If input is 30 FPS, interval = int(30/24) = 1 (processes every frame)
    # If input is 60 FPS, interval = int(60/24) = 2 (processes every 2nd frame)
    frame_interval = max(1, int(round(fps / target_fps)))
    print(f"Target FPS: {target_fps}. Processing 1 of every {frame_interval} frames.")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    # Save the output with the new target_fps
    out = cv2.VideoWriter("outputBatched_24fps.mp4", fourcc, target_fps, (width, height))

    frame_number = 0
    batch_size = 16  # 🔥 Tune this based on your GPU memory

    frames = []
    frame_ids = []

    while frame_number < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if not ret:
            break

        frames.append(frame)
        frame_ids.append(frame_number)

        # Process when batch is full or at the end of the video
        is_last_batch = frame_number + frame_interval >= total_frames
        if len(frames) == batch_size or (is_last_batch and frames):
            
            # --- PERFORMANCE TIP ---
            # Changed device to '0' to use CUDA (GPU).
            # If you do not have an NVIDIA GPU, change this back to 'cpu'
            results = model(frames, conf=0.5, device='0', imgsz=640)
            # -----------------------

            for r in results:
                # .plot() draws the segmentation/boxes on the frame
                annotated = r.plot()
                out.write(annotated)

            print(f"Processed batch, up to frame: {frame_ids[-1]}")
            frames.clear()
            frame_ids.clear()

        frame_number += frame_interval

    cap.release()
    out.release()
    print(f"✅ Saved video at 24 FPS: outputBatched_24fps.mp4")


def test_model_sequential_24fps():
    """
    Processes video frame-by-frame and saves at 24 FPS.
    This method is much slower.
    """
    print("Starting sequential processing for 24 FPS output...")
    model = YOLO("runs/segment/train5/weights/best.pt")

    cap = cv2.VideoCapture("2.mp4")
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Input video: Total Frames: {total_frames}, FPS: {fps}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # --- KEY CHANGE ---
    target_fps = 24
    # ------------------

    frame_interval = max(1, int(round(fps / target_fps)))
    print(f"Target FPS: {target_fps}. Processing 1 of every {frame_interval} frames.")


    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter("output_sequential_24fps.mp4", fourcc, target_fps, (width, height))

    frame_number = 0
    while frame_number < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if not ret:
            break

        # Process frame by frame (slower)
        results = model(frame, conf=0.5, device="cpu")
        annotated_frame = results[0].plot()
        out.write(annotated_frame)

        frame_number += frame_interval  # jump ahead
        
        if frame_number % (frame_interval * 10) == 0: # Log progress
             print(f"Processed frame: {frame_number}")

    cap.release()
    out.release()
    print(f"✅ Saved video at 24 FPS: output_sequential_24fps.mp4")


if __name__ == "__main__":
    print("--- Comparing Sequential vs. Batch Processing for 24 FPS Output ---")
    
    start_seq = time.time()
    # test_model_sequential_24fps() # You can uncomment this, but it will be slow
    end_seq = time.time()
    
    start_batch = time.time()
    test_model_batch_24fps()
    end_batch = time.time()

    print("\n--- Performance Summary ---")
    # print(f"Sequential processing time: {end_seq - start_seq:.2f} seconds")
    print(f"Batch processing time: {end_batch - start_batch:.2f} seconds")
    print("Batch processing is significantly faster, especially on GPU.")
