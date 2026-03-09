import cv2
from ultralytics import YOLO
import time
import threading
import queue
import numpy as np


# --- THREAD 1: FRAME READER ---
def frame_reader_thread(cap, q):
    """
    Reads frames from the video file sequentially and puts them into a queue.
    This is much faster than seeking with cap.set().
    """
    print("Reader Thread: Started...")
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Put the frame into the queue
        # This will block if the queue is full, preventing RAM overflow
        q.put(frame)
        
    q.put(None) # Signal that reading is finished
    print("Reader Thread: Finished.")


# --- THREAD 3: FRAME WRITER ---
def frame_writer_thread(out, q):
    """
    Gets annotated frames from a queue and writes them to the output video file.
    """
    print("Writer Thread: Started...")
    while True:
        # Get a batch of frames to write
        frames_to_write = q.get()
        if frames_to_write is None:
            break # Signal that writing is finished
        
        for frame in frames_to_write:
            out.write(frame)
    
    print("Writer Thread: Finished.")


def test_model_batch_accelerated():
    """
    Processes video using a multi-threaded pipeline (Read -> Process -> Write)
    to keep the GPU saturated and maximize throughput.
    """
    print("Starting ACCELERATED batch processing...")
    
    # --- 1. SETUP ---
    model = YOLO("runs/segment/train5/weights/best.pt")
    print("Model loaded. Using device: '0' (GPU)")
    
    cap = cv2.VideoCapture("2.mp4")
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    target_fps = 24
    # This logic now determines which frames to *process*
    frame_interval = max(1, int(round(fps / target_fps)))
    print(f"Target FPS: {target_fps}. Processing 1 of every {frame_interval} frames.")
    
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter("outputBatched_24fps_ACCELERATED.mp4", fourcc, target_fps, (width, height))
    
    batch_size = 16  # 🔥 Tune this based on your GPU memory
    
    # Create the queues for communication between threads
    # Set a maxsize to prevent runaway memory usage
    read_queue_max = batch_size * 2  # Buffer for 2 batches of *read* frames
    
    # --- FIX: SET A SMALL, SEPARATE LIMIT FOR THE WRITE QUEUE ---
    # This queue holds *batches*, so a maxsize of 2-4 is ideal.
    # This prevents runaway RAM usage from the slow writer.
    write_queue_max = 4 
    # -----------------------------------------------------------
    
    read_queue = queue.Queue(maxsize=read_queue_max)
    write_queue = queue.Queue(maxsize=write_queue_max) # Use the new max size

    # --- 2. START I/O THREADS ---
    reader = threading.Thread(target=frame_reader_thread, args=(cap, read_queue))
    writer = threading.Thread(target=frame_writer_thread, args=(out, write_queue))
    
    reader.start()
    writer.start()

    # --- 3. PROCESSOR (MAIN) LOOP ---
    print("Processor (Main) Thread: Started...")
    frames_batch = []
    frame_count = 0
    
    while True:
        # Get frame from the reader thread
        frame = read_queue.get()
        
        # If data is None, the reader is done
        if frame is None:
            break

        # --- NEW SKIPPING LOGIC ---
        # The processor decides whether to skip this frame, not the reader
        should_process = (frame_count % frame_interval == 0)
        frame_count += 1
        
        if not should_process:
            continue # Skip this frame
        # -------------------------

        frames_batch.append(frame)

        # Process when batch is full
        if len(frames_batch) == batch_size:
            # --- PERFORMANCE BOOST ---
            results = model(frames_batch, conf=0.5, device='0', imgsz=640, half=True)
            # -----------------------
            
            # Annotate frames on the CPU (this can also be a bottleneck)
            annotated_batch = [r.plot() for r in results]
            
            # Put the batch of annotated frames into the write_queue
            # This will now block if the writer is > 4 batches behind
            write_queue.put(annotated_batch)

            print(f"Processed batch, up to frame: {frame_count}")
            frames_batch.clear()

    # If there are any remaining frames in the batch (last batch)
    if frames_batch:
        results = model(frames_batch, conf=0.5, device='0', imgsz=640, half=True)
        annotated_batch = [r.plot() for r in results]
        write_queue.put(annotated_batch)
        print(f"Processed FINAL batch, up to frame: {frame_count}")

    print("Processor (Main) Thread: Finished.")
    
    # --- 4. CLEANUP ---
    write_queue.put(None) # Signal the writer thread to finish
    
    # Wait for threads to complete
    reader.join()
    writer.join()
    
    # Release video objects
    cap.release()
    out.release()
    print(f"✅ Saved accelerated video at 24 FPS: outputBatched_24fps_ACCELERATED.mp4")


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
    height = int(cap.get(cv2.CAP_PROP_HEIGHT))

    target_fps = 24
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
    print("--- Running Accelerated Batch Processing ---")
    
    start_batch = time.time()
    test_model_batch_accelerated()
    end_batch = time.time()

    print("\n--- Performance Summary ---")
    print(f"Accelerated batch processing time: {end_batch - start_batch:.2f} seconds")

