import cv2
from ultralytics import YOLO
import time 


def test_model_batch():
    model = YOLO("runs/segment/train5/weights/best.pt")

    cap = cv2.VideoCapture("2.mp4")
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print("total Frames:", total_frames, " Fps:", fps)

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    target_fps = 2
    frame_interval = int(fps / target_fps)  # step size

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter("outputBatched.mp4", fourcc, target_fps, (width, height))

    frame_number = 0
    batch_size = 16   # 🔥 tune this based on GPU memory

    frames = []
    frame_ids = []

    while frame_number < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if not ret:
            break

        frames.append(frame)
        frame_ids.append(frame_number)

        # Process when batch is full or at the end
        if len(frames) == batch_size or frame_number + frame_interval >= total_frames:
            results = model(frames, conf=0.5, device=0, imgsz=640)  # GPU + batching

            for r, f in zip(results, frames):
                annotated = r.plot()
                out.write(annotated)

            print(f"Processed frames up to: {frame_ids[-1]}")
            frames.clear()
            frame_ids.clear()

        frame_number += frame_interval

    cap.release()
    out.release()
    print("✅ Saved video at 2 FPS: output.mp4")



def test_model():
    model = YOLO("runs/segment/train5/weights/best.pt")

    cap = cv2.VideoCapture("2.mp4")
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print("total Frames: ", total_frames, " Fps: ", fps)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    target_fps = 2
    frame_interval = int(fps / target_fps)  # step size

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter("output.mp4", fourcc, target_fps, (width, height))

    frame_number = 0
    while frame_number < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame, conf=0.5, device=0)
        annotated_frame = results[0].plot()
        out.write(annotated_frame)

        frame_number += frame_interval  # jump ahead
        print("processed: ", frame_number)

    cap.release()
    out.release()
    print("✅ Saved video at 2 FPS: output.mp4")

if __name__ == "__main__":
    start = time.time()
    test_model()
    end = time.time()
    start2 = time.time()
    test_model_batch()
    end2 = time.time()
    print(f"Execution time: {end - start:.2f} seconds")
    print(f"Execution time: {end2 - start2:.2f} seconds With Batch")