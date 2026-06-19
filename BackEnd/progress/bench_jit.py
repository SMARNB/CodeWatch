"""Does TorchScript (conv-bn fusion) make MiniFASNet fast? And is the single model accurate?"""
import time
import os
import numpy as np
import torch
import cv2

from liveness import LivenessDetector

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "liveness", "samples")
GT = {"image_T1.jpg": True, "image_F1.jpg": False, "image_F2.jpg": False}


def bench(net, device, n=300, label=""):
    x = torch.rand(1, 3, 80, 80, device=device) * 255.0
    with torch.no_grad():
        for _ in range(30):
            net(x)
        if device.type == "cuda":
            torch.cuda.synchronize()
        t0 = time.perf_counter()
        for _ in range(n):
            net(x)
        if device.type == "cuda":
            torch.cuda.synchronize()
    ms = (time.perf_counter() - t0) / n * 1000
    print(f"  {label:28s}: {ms:6.2f} ms")
    return ms


def make_jit(net, device):
    net = net.eval()
    x = torch.rand(1, 3, 80, 80, device=device) * 255.0
    with torch.no_grad():
        traced = torch.jit.trace(net, x)
        traced = torch.jit.optimize_for_inference(traced)
    return traced


def main():
    print("=" * 60)
    print("TORCHSCRIPT SPEED TEST (single model: MiniFASNetV2 @ 2.7)")
    print("=" * 60)
    for dev in ([torch.device("cuda"), torch.device("cpu")] if torch.cuda.is_available()
                else [torch.device("cpu")]):
        print(f"\n[{dev.type.upper()}]")
        det = LivenessDetector(ensemble=False, device=dev)
        net = det.models[0].net
        bench(net, dev, label="eager")
        jit = make_jit(net, dev)
        if dev.type == "cuda":
            torch.backends.cudnn.benchmark = True
        bench(jit, dev, label="jit + optimize_for_inference")
        torch.backends.cudnn.benchmark = False

    # Accuracy: single model vs ensemble, to justify defaulting to single.
    print("\n" + "=" * 60)
    print("ACCURACY: single vs ensemble (InsightFace bbox)")
    print("=" * 60)
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    det_single = LivenessDetector(ensemble=False, device=dev)
    det_ens = LivenessDetector(ensemble=True, device=dev)
    for name, truth in GT.items():
        img = cv2.imread(os.path.join(SAMPLE_DIR, name))
        faces = app.get(img)
        faces.sort(key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)
        b = tuple(int(v) for v in faces[0].bbox)
        rs = det_single.analyze(img, b)
        re = det_ens.analyze(img, b)
        print(f"  {name:14s} truth={'LIVE ' if truth else 'SPOOF'}  "
              f"single P_real={rs.real_prob:.3f}->{'LIVE' if rs.is_live else 'SPOOF':5s}  "
              f"ensemble P_real={re.real_prob:.3f}->{'LIVE' if re.is_live else 'SPOOF':5s}")
    print("=" * 60)


if __name__ == "__main__":
    main()
