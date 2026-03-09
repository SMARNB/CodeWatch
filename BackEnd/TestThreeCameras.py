import cv2
from ultralytics import YOLO
import time
import threading
import queue
import numpy as np


def run_multi_camera_realtime():
    """
    Processes 3 video streams in real-time using batching and multi-threading.
    """
    print("Starting multi-camera real-time processing...")
    
    # --- CONFIGURATION ---
    # TODO: Change these to your camera sources
    # Use 0, 1, 2 for webcams, or RTSP/HTTP stream URLs
    cam_sources = [
        "2.mp4",  # Camera 1
        "2.mp4",  # Camera 2 (using same file for demo)
        "2.mp4",  # Camera 3 (using same file for demo)
    ]
    
    num_cams = len(cam_sources)
    model_path = "runs/segment/train5/weights/best.pt"
    img_size = 640
    conf_threshold = 0.5
    
    # -----------------------

    # Load the model ONCE
    print(f"Loading model: {model_path}")
    model = YOLO(model_path)
    print("Model loaded. Using device: '0' (GPU)")

    # Create a queue for each camera to hold frames
    frame_queues = [queue.Queue(maxsize=1) for _ in range(num_cams)]
    
    # --- READER THREAD FUNCTION ---
    def frame_reader(source, q, cap_index):
        """
        Reads frames from a camera source and puts them into a queue.
        Runs in its own thread.
        """
        print(f"Starting reader thread for camera {cap_index} ({source})...")
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print(f"Error: Could not open camera {cap_index}.")
            return

        while True:
            try:
                ret, frame = cap.read()
                if not ret:
                    print(f"Camera {cap_index} stream ended. Re-opening...")
                    cap.release()
                    cap = cv2.VideoCapture(source) # Attempt to reconnect
                    if not cap.isOpened():
                        time.sleep(5)
                        continue
                    ret, frame = cap.read()
                    if not ret:
                        continue # Skip if still failing

                # Block until the processor has taken the last frame
                # This ensures we always process the LATEST frame
                q.put(frame) 
            
            except Exception as e:
                print(f"Error in reader thread {cap_index}: {e}")
                cap.release()
                time.sleep(5) # Wait before retrying
                cap = cv2.VideoCapture(source)

    # --- Start Reader Threads ---
    reader_threads = []
    for i in range(num_cams):
        t = threading.Thread(target=frame_reader, args=(cam_sources[i], frame_queues[i], i), daemon=True)
        t.start()
        reader_threads.append(t)

    print("All reader threads started. Waiting for first frames...")
    # Wait for all queues to have at least one frame
    for i, q in enumerate(frame_queues):
        while q.empty():
            print(f"Waiting for camera {i}...")
            time.sleep(0.5)

    print("All cameras ready. Starting processing loop...")

    # --- PROCESSOR (MAIN) LOOP ---
    batch = []
    start_time = time.time()
    frame_count = 0

    while True:
        # 1. Get latest frame from each camera queue
        batch.clear()
        for q in frame_queues:
            # Get frame from queue (will block if empty, but reader ensures it's not)
            frame = q.get()
            batch.append(frame)

        if not batch:
            continue

        # 2. Process the batch
        # --- KEY OPTIMIZATIONS ---
        # device='0' (GPU), half=True (FP16), imgsz=img_size
        results = model(batch, conf=conf_threshold, device='0', imgsz=img_size, half=True)
        # -----------------------

        # 3. Annotate and Display
        annotated_frames = []
        for r in results:
            annotated = r.plot()
            annotated_frames.append(annotated)

        # 4. Display the results
        # Stack frames horizontally
        if annotated_frames:
            display_frame = np.hstack(annotated_frames)
            cv2.imshow("Multi-Camera Real-Time (YOLOv8)", display_frame)

            frame_count += 1
            if time.time() - start_time >= 1.0:
                fps = frame_count / (time.time() - start_time)
                print(f"Processing FPS (for {num_cams} cams): {fps:.2f}")
                frame_count = 0
                start_time = time.time()

        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("'q' pressed. Exiting...")
            break

    cv2.destroyAllWindows()
    print("Processing stopped.")


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
    # --- Run the new multi-camera real-time function ---
    run_multi_camera_realtime()


    # --- Old comparison code is commented out below ---
    # print("--- Comparing Sequential vs. Batch Processing for 24 FPS Output ---")
    
    # start_seq = time.time()
    # # test_model_sequential_24fps() # You can uncomment this, but it will be slow
    # end_seq = time.time()
    
    # start_batch = time.time()
    # test_model_batch_24fps()
    # end_batch = time.time()

    # print("\n--- Performance Summary ---")
    # # print(f"Sequential processing time: {end_seq - start_seq:.2f} seconds")
    # print(f"Batch processing time: {end_batch - start_batch:.2f} seconds")
    # print("Batch processing is significantly faster, especially on GPU.")

