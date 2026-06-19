"""Face liveness / presentation-attack detection (PAD) for CodeWatch.

Lightweight RGB anti-spoofing built on the vendored MiniFASNet (Silent-Face) models.
Gates InsightFace recognition so a printed photo / phone screen / video replay can't
spoof a known identity. See detector.LivenessDetector.
"""
from .detector import LivenessDetector, LivenessResult, LABEL_REAL, LABEL_SPOOF_2D, LABEL_SPOOF_3D

__all__ = [
    "LivenessDetector",
    "LivenessResult",
    "LABEL_REAL",
    "LABEL_SPOOF_2D",
    "LABEL_SPOOF_3D",
]
