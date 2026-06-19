# CodeWatch Liveness / Anti-Spoofing (PAD)

A lightweight **RGB presentation-attack-detection** gate for the face-recognition pipeline.
Without it, a printed photo, phone/tablet screen, or video replay can spoof a known identity.
With it, an InsightFace match is only trusted once the face is voted **live**.

## Model
- **MiniFASNet** CNN from the open-source **Silent-Face-Anti-Spoofing** project (Minivision AI,
  Apache-2.0), benchmark-validated on OULU-NPU / SiW. Architecture is vendored verbatim in
  [`minifasnet.py`](minifasnet.py); the crop math in [`crop.py`](crop.py).
- Pretrained weights in [`weights/`](weights/) (~1.8 MB each):
  - `2.7_80x80_MiniFASNetV2.pth` — the single light model (default).
  - `4_0_0_80x80_MiniFASNetV1SE.pth` — the second member of the optional ensemble.
- Input: the face crop is expanded by the scale baked into each filename (2.7 / 4.0), resized to
  80×80, kept in **[0,255]** (no `/255`, no BGR→RGB swap — matching the upstream training).
- Output: 3-class softmax `[spoof_2d, real, spoof_3d]`; class **1 = live**. The ensemble averages
  the softmax of both models. A frame is "live" if `argmax == 1` **and** `P(real) >= threshold`.
- Speed: each net is **TorchScript-fused** (Conv+BN folding) at load, ~2× faster, with an eager
  fallback if tracing ever fails.

## How it's wired into `FinalSystem.py`
The detector is created once after InsightFace loads (shared, thread-safe). In the recognition
path, after a face matches a known identity:
1. **Multi-frame vote** — `CameraThread._check_liveness` runs PAD on the same crop InsightFace
   embedded and collects `liveness_min_votes` reads across consecutive frames (InsightFace keeps
   running while `confirmed=False`).
2. **Once-per-track cache** — once decided, the verdict is stored on the track; PAD stops running
   for that track for its lifetime.
3. **Gate** — while voting, the track shows amber **"Verifying…"** and its identity is *held*
   (no movement / violation / handover logging). On a **live** verdict the identity is accepted
   normally; on a **spoof** verdict the match is rejected, the box turns red **"SPOOF / FAKE
   FACE"**, and (optionally) a *"Spoofing Attempt (Liveness)"* violation is logged.
4. **Fail-open** — if the face is below `liveness_min_face` px the whole time (too far to judge),
   PAD abstains and the match is accepted, so distant legitimate faces are never false-rejected.
   This is appropriate because CodeWatch is passive surveillance, not access control, and spoofs
   are presented close to the camera.

## Config (`PARAMS` in `FinalSystem.py`)
| key | default | meaning |
|---|---|---|
| `liveness_enabled` | `True` | master switch for the gate |
| `liveness_ensemble` | `False` | `False` = single light model; `True` = 2-model Silent-Face ensemble |
| `liveness_threshold` | `0.5` | min averaged `P(real)` for a frame to be live |
| `liveness_min_votes` | `3` | PAD reads to collect before deciding |
| `liveness_live_ratio` | `0.6` | fraction of votes that must be live to accept |
| `liveness_max_attempts` | `12` | stop sampling after N frames, then fail-open |
| `liveness_min_face` | `50` | min face bbox edge (px) to trust a read |
| `liveness_log_violations` | `True` | log a violation when a spoof is rejected |
| `rppg_enabled` | `False` | optional pulse check — **off**, not built into the hot path |

## Measured results (this machine, RTX-class GPU, torch 2.5.1+cu121)
- **Correctness** (Silent-Face sample faces, via InsightFace bbox): 3/3.
  - genuine live `image_T1` → **LIVE**, `P(real)=1.000`
  - spoof `image_F1` / `image_F2` → **SPOOF**, `P(real)=0.005 / 0.003`
- **Speed** (TorchScript): **~3.6 ms/face** single model, **~8 ms/face** ensemble; InsightFace
  recognition on the same crop is ~25–30 ms. PAD runs only during the brief once-per-track
  verification window, so the amortised added GPU load is small (single digits %).

## Tests / demo (run from `BackEnd/`)
```
venv\Scripts\python.exe test_liveness.py            # model correctness + ms/face benchmark
venv\Scripts\python.exe bench_jit.py                # TorchScript speedup + single-vs-ensemble accuracy
venv\Scripts\python.exe test_integration.py         # the real FinalSystem gate: live/spoof/cache/fail-open
venv\Scripts\python.exe test_liveness_webcam.py     # live demo: real face vs phone/photo (press q)
```

Attribution: model architecture, crop, and sample images are from
https://github.com/minivision-ai/Silent-Face-Anti-Spoofing (Apache-2.0).
