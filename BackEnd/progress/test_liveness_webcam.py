"""Live webcam liveness demo — confirm a real face PASSES and a phone screen / printed photo
is REJECTED, on your own hardware.

GUI mode (default):
    venv\\Scripts\\python.exe test_liveness_webcam.py
  A green box "LIVE p=0.99" is drawn around a genuine face; hold up a phone showing a face or a
  printed photo and the box turns red "SPOOF p=0.03". Press q to quit; avg ms/face is printed.

Headless smoke test (no window — for a quick "does it run on this PC" check):
    venv\\Scripts\\python.exe test_liveness_webcam.py --headless --frames 30

Options: --cam N (device index) | --ensemble (2-model Silent-Face) | --threshold 0.5
"""
import argparse
import time

import cv2
import numpy as np

from liveness import LivenessDetector


def resolve_cam(requested):
    """Avoid the OBS Virtual Camera (it emits a standby logo even when OBS is closed). Pick the
    first DirectShow device whose name lacks 'obs'/'virtual'; fall back to the requested index."""
    try:
        from pygrabber.dshow_graph import FilterGraph
        names = FilterGraph().get_input_devices()
        for i, n in enumerate(names):
            if "obs" not in n.lower() and "virtual" not in n.lower():
                return i, names
        return requested, names
    except Exception:
        return requested, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cam", type=int, default=0)
    ap.add_argument("--ensemble", action="store_true", help="use the 2-model Silent-Face ensemble")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--headless", action="store_true", help="no GUI window; print verdicts")
    ap.add_argument("--frames", type=int, default=0, help="process N frames then exit (0 = until q)")
    args = ap.parse_args()

    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    det = LivenessDetector(ensemble=args.ensemble, threshold=args.threshold)
    print(f"Liveness: {'ensemble' if det.ensemble else 'single'} model on {det.device} "
          f"(thr={det.threshold}). This is a per-frame demo (no multi-frame vote).")

    idx, names = resolve_cam(args.cam)
    if names:
        print("Detected cameras:", {i: n for i, n in enumerate(names)}, "-> using index", idx)
    cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    if not cap.isOpened():
        print(f"Could not open camera index {idx}.")
        return 1

    ms_hist = []
    n = 0
    misses = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            misses += 1
            if misses > 60:
                print("Camera not delivering frames; exiting.")
                break
            time.sleep(0.05)
            continue
        misses = 0
        for f in app.get(frame):
            b = tuple(int(v) for v in f.bbox)
            t0 = time.perf_counter()
            res = det.analyze(frame, b)
            ms = (time.perf_counter() - t0) * 1000
            ms_hist.append(ms)
            if not res.valid:
                color, txt = (0, 180, 255), f"abstain ({res.reason})"
            elif res.is_live:
                color, txt = (0, 255, 0), f"LIVE  p={res.real_prob:.2f}  {ms:.1f}ms"
            else:
                color, txt = (0, 0, 255), f"SPOOF p={res.real_prob:.2f}  {ms:.1f}ms"
            cv2.rectangle(frame, (b[0], b[1]), (b[2], b[3]), color, 2)
            cv2.putText(frame, txt, (b[0], max(0, b[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            if args.headless:
                print(f"  frame {n}: {txt}")
        n += 1
        if not args.headless:
            cv2.putText(frame, "press q to quit", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.imshow("CodeWatch Liveness Demo", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
        if args.frames and n >= args.frames:
            break

    cap.release()
    cv2.destroyAllWindows()
    if ms_hist:
        print(f"\nFaces scored: {len(ms_hist)} | avg {np.mean(ms_hist):.2f} ms/face | "
              f"p50 {np.median(ms_hist):.2f} | p95 {np.percentile(ms_hist, 95):.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
