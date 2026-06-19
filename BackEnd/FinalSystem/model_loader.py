"""Loads the heavy AI models once, at import, and shares them across all camera threads.

Exposes:
    yolo_model_base    a global YOLO seg model (kept for parity with the monolith)
    dresscode_model    the dress-code YOLO (or None if its weights are missing)
    app                the InsightFace FaceAnalysis instance (face detect + embed)
    liveness_detector  the MiniFASNet PAD gate (or None if disabled/failed)
    new_yolo_seg()     factory for a fresh per-CameraThread YOLO seg model
"""
import os
import sys

from ultralytics import YOLO
from insightface.app import FaceAnalysis

from . import config

# Make BackEnd importable so `from liveness import ...` resolves regardless of the working
# directory the engine is launched from.
if config.BACKEND_DIR not in sys.path:
    sys.path.insert(0, config.BACKEND_DIR)

print("🧠 Loading Global AI Models... (YOLO + InsightFace)")
try:
    yolo_model_base = YOLO(config.YOLO_SEG_WEIGHTS)
except Exception:
    print("⚠️ Could not load primary YOLO seg weights. Trying fallback.")
    yolo_model_base = YOLO(os.path.join(config.BACKEND_DIR, "yolo11n-seg.pt"))

print("👗 Loading Dress Code Model...")
try:
    dresscode_model = YOLO(config.DRESSCODE_MODEL_PATH)
except Exception as e:
    print(f"⚠️ Could not load dress code model: {e}")
    dresscode_model = None

app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

# --- Liveness / anti-spoofing (PAD) model ---
# Lightweight MiniFASNet (Silent-Face) gate. Loaded once and shared across camera threads;
# inference is serialised internally. If it fails to load, the system runs exactly as before
# (recognition without a liveness gate) rather than crashing.
liveness_detector = None
if config.PARAMS.get("liveness_enabled", True):
    try:
        from liveness import LivenessDetector
        liveness_detector = LivenessDetector(
            ensemble=config.PARAMS.get("liveness_ensemble", False),
            threshold=config.PARAMS.get("liveness_threshold", 0.5),
            min_face=config.PARAMS.get("liveness_min_face", 50),
        )
        print(f"🛡️  Liveness PAD enabled "
              f"({'ensemble' if liveness_detector.ensemble else 'single'} model, "
              f"device={liveness_detector.device}, weights={liveness_detector.model_names}).")
    except Exception as e:
        print(f"⚠️  Liveness PAD disabled (init failed): {e}")
        liveness_detector = None
else:
    print("🛡️  Liveness PAD disabled via PARAMS['liveness_enabled']=False.")
if config.PARAMS.get("rppg_enabled", False):
    print("ℹ️  rPPG pulse check requested but not implemented in the hot path — ignoring.")


def new_yolo_seg():
    """A fresh YOLO seg model for a CameraThread. Each camera gets its own instance to avoid
    CUDA contention (mirrors the monolith's per-thread model)."""
    return YOLO(config.YOLO_SEG_WEIGHTS)
