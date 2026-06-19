"""End-to-end-ish check of the liveness gate wired INTO the FinalSystem package.

Importing the FinalSystem modules runs their real setup (config + YOLO + InsightFace + the
liveness detector) without starting any camera threads (the loop lives in main, under __main__).
We then drive the real CameraThread._check_liveness state machine (it uses no self attributes)
with the bundled sample faces to prove: a live face -> 'live', a spoof -> 'spoof', the verdict is
cached, and a too-small face fails open.

Run from BackEnd/:  venv\\Scripts\\python.exe test_integration.py
"""
import os
import sys
import cv2

from FinalSystem import config, model_loader
from FinalSystem.surveillance_tracker import CameraThread

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "liveness", "samples")


class FakeTrack:
    """Stand-in for a DeepSort track — _check_liveness only sets/reads .liveness on it."""
    pass


def bbox_for(img):
    faces = model_loader.app.get(img)
    faces.sort(key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
    return faces[0].bbox


def drive(img, bbox, frames=8):
    track = FakeTrack()
    states = [CameraThread._check_liveness(None, track, img, bbox) for _ in range(frames)]
    return states, track.liveness


def main():
    print("\n" + "=" * 70)
    print("FINALSYSTEM LIVENESS-GATE INTEGRATION TEST")
    print("=" * 70)
    if model_loader.liveness_detector is None:
        print("FAIL: FinalSystem.liveness_detector did not initialise.")
        return 1
    print(f"detector OK: {model_loader.liveness_detector.model_names} on {model_loader.liveness_detector.device}")
    print(f"vote config: min_votes={config.PARAMS['liveness_min_votes']}, "
          f"live_ratio={config.PARAMS['liveness_live_ratio']}, "
          f"max_attempts={config.PARAMS['liveness_max_attempts']}, "
          f"min_face={config.PARAMS['liveness_min_face']}\n")

    all_ok = True
    for name, truth in [("image_T1.jpg", "live"), ("image_F1.jpg", "spoof"), ("image_F2.jpg", "spoof")]:
        img = cv2.imread(os.path.join(SAMPLE_DIR, name))
        states, ls = drive(img, bbox_for(img), frames=8)
        final = "live" if ls["is_live"] else "spoof"
        # caching: must decide within max_attempts and stop changing afterwards
        decided_idx = next((i for i, s in enumerate(states) if s != "pending"), None)
        cached = decided_idx is not None and all(s == final for s in states[decided_idx:])
        ok = (final == truth) and cached
        all_ok &= ok
        print(f"  {name:14s} states={states}")
        print(f"  {'':14s} -> {final.upper():5s} score={ls['score']:.3f} votes={ls['live']}/{len(ls['scores'])} "
              f"cached={cached}  expect={truth.upper():5s}  {'OK' if ok else 'WRONG'}\n")

    # Fail-open: a face below min_face must abstain every frame, then accept (never false-reject).
    img = cv2.imread(os.path.join(SAMPLE_DIR, "image_T1.jpg"))
    track = FakeTrack()
    for _ in range(config.PARAMS["liveness_max_attempts"] + 2):
        CameraThread._check_liveness(None, track, img, (10, 10, 28, 28))
    ls = track.liveness
    fail_open_ok = ls["decided"] and ls["is_live"] and len(ls["scores"]) == 0
    all_ok &= fail_open_ok
    print(f"  tiny-face fail-open: decided={ls['decided']} is_live={ls['is_live']} "
          f"reads={len(ls['scores'])}  {'OK' if fail_open_ok else 'WRONG'}")

    print("=" * 70)
    print("RESULT:", "ALL OK ✅" if all_ok else "FAILURES ❌")
    print("=" * 70)
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
