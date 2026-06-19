# LivenessDetector — RGB face anti-spoofing / presentation-attack detection (PAD) gate.
#
# Wraps the vendored MiniFASNet (Silent-Face) models. Unlike the upstream reference, both
# weights are loaded ONCE at construction and reused, and inference is serialised with a lock
# so multiple CameraThreads can share one detector on the GPU.
#
# Usage:
#     det = LivenessDetector()                       # loads weights, picks CUDA if available
#     res = det.analyze(image_bgr, (x1, y1, x2, y2)) # bbox in image_bgr's pixel coords
#     if res.is_live: ...
#
# Each model outputs a 3-class score [spoof_2d, real, spoof_3d]; the ensemble averages the
# softmax of every model. label==1 (real) is "live"; we additionally require the averaged
# real-probability to clear `threshold` so borderline frames don't pass on a bare argmax.
import os
import glob
import threading

import cv2
import numpy as np
import torch
import torch.nn.functional as F

from .minifasnet import MODEL_MAPPING
from .crop import CropImage

_WEIGHTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weights")

# Class index meanings of the MiniFASNet head (Silent-Face convention).
LABEL_SPOOF_2D = 0   # print / screen replay
LABEL_REAL = 1       # genuine live face
LABEL_SPOOF_3D = 2   # 3D mask / other


def get_kernel(height, width):
    return ((height + 15) // 16, (width + 15) // 16)


def parse_model_name(model_name):
    """Pull (h_input, w_input, model_type, scale) out of a Silent-Face weight filename,
    e.g. '2.7_80x80_MiniFASNetV2.pth' -> (80, 80, 'MiniFASNetV2', 2.7). Matches upstream."""
    info = model_name.split('_')[0:-1]
    h_input, w_input = info[-1].split('x')
    model_type = model_name.split('.pth')[0].split('_')[-1]
    scale = None if info[0] == "org" else float(info[0])
    return int(h_input), int(w_input), model_type, scale


class LivenessResult:
    __slots__ = ("label", "real_prob", "scores", "is_live", "valid", "reason")

    def __init__(self, label, real_prob, scores, is_live, valid=True, reason=""):
        self.label = label            # argmax class (0/1/2)
        self.real_prob = real_prob    # averaged P(real) in [0, 1]
        self.scores = scores          # full 3-vector of averaged probabilities
        self.is_live = is_live        # final gate decision for this single frame
        self.valid = valid            # False => face too small / crop failed; caller should abstain
        self.reason = reason

    def __repr__(self):
        return (f"LivenessResult(label={self.label}, real_prob={self.real_prob:.3f}, "
                f"is_live={self.is_live}, valid={self.valid}, reason='{self.reason}')")


class _SubModel:
    def __init__(self, net, scale, h, w):
        self.net = net
        self.scale = scale    # crop expansion baked into the weight filename
        self.h = h
        self.w = w


class LivenessDetector:
    def __init__(self, weights_dir=_WEIGHTS_DIR, device=None, threshold=0.5,
                 ensemble=False, min_face=80, jit=True):
        """
        weights_dir : folder of MiniFASNet .pth files (filenames encode scale + input size).
        device      : torch device; defaults to CUDA if available else CPU.
        threshold   : minimum averaged P(real) for a frame to count as live.
        ensemble    : False (default) -> single light model (MiniFASNetV2 @ 2.7), fastest and
                      cleanly accurate; True -> the full Silent-Face ensemble (every weight in
                      the folder) for higher assurance at ~2x cost.
        min_face    : minimum face bbox edge (px) to trust a PAD score; smaller -> abstain.
        jit         : TorchScript-fuse each net (folds Conv+BN) — ~2x faster, with eager fallback.
        """
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.threshold = float(threshold)
        self.min_face = int(min_face)
        self.ensemble = bool(ensemble)
        self._lock = threading.Lock()
        self._crop = CropImage()

        paths = sorted(glob.glob(os.path.join(weights_dir, "*.pth")))
        if not paths:
            raise FileNotFoundError(f"No MiniFASNet .pth weights found in {weights_dir}")

        if not ensemble:
            # Prefer the lighter V2 (scale 2.7) single model when not ensembling.
            v2 = [p for p in paths if "MiniFASNetV2" in os.path.basename(p)]
            paths = v2[:1] or paths[:1]

        self.models = []
        for path in paths:
            name = os.path.basename(path)
            h, w, model_type, scale = parse_model_name(name)
            net = MODEL_MAPPING[model_type](conv6_kernel=get_kernel(h, w)).to(self.device)
            self._load_state(net, path)
            net.eval()
            if jit:
                net = self._jit_compile(net, h, w)
            self.models.append(_SubModel(net, scale, h, w))
        self.model_names = [os.path.basename(p) for p in paths]

    @torch.no_grad()
    def _jit_compile(self, net, h, w):
        """TorchScript-trace + optimize_for_inference (fuses Conv+BN). Falls back to the eager
        module if tracing isn't supported, so a torch quirk never disables liveness."""
        try:
            example = torch.rand(1, 3, h, w, device=self.device)
            traced = torch.jit.optimize_for_inference(torch.jit.trace(net, example))
            for _ in range(3):  # warm up fused kernels
                traced(example)
            return traced
        except Exception as e:
            print(f"⚠️  Liveness JIT compile failed ({e}); using eager model.")
            return net

    def _load_state(self, net, path):
        try:
            state = torch.load(path, map_location=self.device, weights_only=True)
        except Exception:
            state = torch.load(path, map_location=self.device)
        first = next(iter(state))
        if first.startswith("module."):
            state = {k[7:]: v for k, v in state.items()}
        net.load_state_dict(state)

    def _to_tensor(self, patch_bgr):
        # Replicates Silent-Face's trans.ToTensor EXACTLY: HWC uint8 BGR -> CHW float, kept in
        # the [0,255] range (upstream deliberately commented out the div(255)), and NO BGR->RGB
        # swap. The first BatchNorm absorbs the scale; dividing by 255 here feeds near-zero
        # inputs and collapses every face to the same garbage class.
        arr = np.ascontiguousarray(patch_bgr.transpose(2, 0, 1))
        return torch.from_numpy(arr).float()

    @torch.no_grad()
    def analyze(self, image_bgr, bbox_xyxy):
        """Run PAD on one face. bbox_xyxy = (x1, y1, x2, y2) in image_bgr coordinates."""
        if image_bgr is None or image_bgr.size == 0:
            return LivenessResult(-1, 0.0, np.zeros(3), False, valid=False, reason="empty image")

        x1, y1, x2, y2 = [int(v) for v in bbox_xyxy]
        bw, bh = x2 - x1, y2 - y1
        if bw <= 0 or bh <= 0:
            return LivenessResult(-1, 0.0, np.zeros(3), False, valid=False, reason="bad bbox")
        if min(bw, bh) < self.min_face:
            return LivenessResult(-1, 0.0, np.zeros(3), False, valid=False, reason="face too small")

        # CropImage expects bbox as [x, y, w, h].
        bbox_xywh = [x1, y1, bw, bh]
        fused = np.zeros(3, dtype=np.float64)
        with self._lock:
            for m in self.models:
                patch = self._crop.crop(image_bgr, bbox_xywh, m.scale, m.w, m.h,
                                        crop=(m.scale is not None))
                if patch is None or patch.size == 0:
                    return LivenessResult(-1, 0.0, np.zeros(3), False, valid=False, reason="crop failed")
                t = self._to_tensor(patch).unsqueeze(0).to(self.device)
                out = self.models_forward(m.net, t)
                fused += F.softmax(out, dim=1).cpu().numpy().reshape(-1)
        fused /= max(1, len(self.models))

        label = int(np.argmax(fused))
        real_prob = float(fused[LABEL_REAL])
        is_live = (label == LABEL_REAL) and (real_prob >= self.threshold)
        return LivenessResult(label, real_prob, fused, is_live, valid=True)

    @staticmethod
    def models_forward(net, tensor):
        return net.forward(tensor)
