"""Diagnostic: run ONE real CameraThread from the refactored package for a few seconds and
report any error / whether the webcam actually opens and delivers frames.

Run from BackEnd/:  venv\\Scripts\\python.exe diag_camera.py
"""
import threading
import time
import traceback

from FinalSystem import model_loader  # noqa: F401  (loads YOLO + InsightFace + liveness)
from FinalSystem.surveillance_tracker import CameraThread

errors = []
def _hook(args):
    errors.append((args.exc_type.__name__, str(args.exc_value)))
    traceback.print_exception(args.exc_type, args.exc_value, args.exc_traceback)
threading.excepthook = _hook

cam = {"camera_id": "Cam1", "name": "DiagCam", "stream_url": "0"}
print("=== creating CameraThread (loads its own YOLO) ===")
ct = CameraThread(cam)
print("=== starting; running 8s ===")
ct.start()
time.sleep(8)
ct.force_stop()
ct.join(timeout=6)
print("\n=== RESULT ===")
print("thread crashed with:", errors if errors else "no exception")
print("thread still alive:", ct.is_alive())
