"""Standalone validation + benchmark for the liveness (PAD) model.

Run from BackEnd/:
    venv\\Scripts\\python.exe test_liveness.py

What it does:
  1. Correctness — runs the detector on the bundled Silent-Face sample images
     (image_T1 = genuine live, image_F1/F2 = spoof). Uses InsightFace to find the
     face bbox, exactly as the live pipeline will, so this tests the real path.
  2. Speed — measures ms/face for the 2-model ensemble vs the single light model,
     and times InsightFace on the same crops so we can state the real added cost.
"""
import os
import time
import glob

import cv2
import numpy as np
import torch

from liveness import LivenessDetector, LABEL_REAL

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "liveness", "samples")

# Ground truth from the upstream sample set (encoded in the filenames).
GROUND_TRUTH = {
    "image_T1.jpg": True,   # genuine live face
    "image_F1.jpg": False,  # spoof
    "image_F2.jpg": False,  # spoof
}


def _sync():
    if torch.cuda.is_available():
        torch.cuda.synchronize()


def insightface_bbox(app, img):
    """Largest detected face -> (x1,y1,x2,y2) ints, or None."""
    faces = app.get(img)
    if not faces:
        return None
    faces.sort(key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
    b = faces[0].bbox
    return tuple(int(v) for v in b)


def main():
    print("=" * 70)
    print("LIVENESS / PAD VALIDATION")
    print("=" * 70)

    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))

    det = LivenessDetector(ensemble=True)
    print(f"Device: {det.device} | models: {det.model_names} | threshold: {det.threshold}\n")

    # ---------- 1. Correctness ----------
    samples = []
    correct = 0
    total = 0
    for name, is_live_truth in GROUND_TRUTH.items():
        path = os.path.join(SAMPLE_DIR, name)
        img = cv2.imread(path)
        if img is None:
            print(f"  [!] missing sample {path}")
            continue
        bbox = insightface_bbox(app, img)
        if bbox is None:
            print(f"  [!] InsightFace found no face in {name}")
            continue
        res = det.analyze(img, bbox)
        samples.append((img, bbox))
        ok = (res.is_live == is_live_truth)
        correct += int(ok)
        total += 1
        verdict = "LIVE" if res.is_live else "SPOOF"
        truth = "LIVE" if is_live_truth else "SPOOF"
        print(f"  {name:14s} -> predicted {verdict:5s} (P_real={res.real_prob:.3f}, "
              f"label={res.label})  truth={truth:5s}  {'OK' if ok else 'WRONG'}")
    print(f"\n  Correctness: {correct}/{total} sample images classified correctly.\n")

    if not samples:
        print("No usable samples; aborting benchmark.")
        return

    # ---------- 2. Speed ----------
    bench_img, bench_bbox = samples[0]
    N = 200

    # Ensemble PAD
    for _ in range(10):
        det.analyze(bench_img, bench_bbox)
    _sync()
    t0 = time.perf_counter()
    for _ in range(N):
        det.analyze(bench_img, bench_bbox)
    _sync()
    ens_ms = (time.perf_counter() - t0) / N * 1000

    # Single light model
    det_single = LivenessDetector(ensemble=False)
    for _ in range(10):
        det_single.analyze(bench_img, bench_bbox)
    _sync()
    t0 = time.perf_counter()
    for _ in range(N):
        det_single.analyze(bench_img, bench_bbox)
    _sync()
    single_ms = (time.perf_counter() - t0) / N * 1000

    # InsightFace on the same image, for context (this is what PAD piggybacks on).
    for _ in range(5):
        app.get(bench_img)
    _sync()
    t0 = time.perf_counter()
    M = 50
    for _ in range(M):
        app.get(bench_img)
    _sync()
    insf_ms = (time.perf_counter() - t0) / M * 1000

    print("=" * 70)
    print("SPEED (per face, GPU)")
    print("=" * 70)
    print(f"  PAD ensemble (2 models): {ens_ms:7.2f} ms/face")
    print(f"  PAD single  (1 model)  : {single_ms:7.2f} ms/face")
    print(f"  InsightFace detect+embed: {insf_ms:7.2f} ms/face (for context)")
    print()
    print(f"  Added cost vs an InsightFace recognition step:")
    print(f"     ensemble: +{ens_ms / insf_ms * 100:5.1f}%   single: +{single_ms / insf_ms * 100:5.1f}%")
    print()
    print(f"  As share of a 33 ms (30 FPS) frame budget, when PAD runs that frame:")
    print(f"     ensemble: {ens_ms / 33.0 * 100:5.1f}%   single: {single_ms / 33.0 * 100:5.1f}%")
    print("=" * 70)


if __name__ == "__main__":
    main()
