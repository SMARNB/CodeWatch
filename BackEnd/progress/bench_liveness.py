"""Micro-benchmark to find the fastest device/config for the PAD model.

Isolates where the per-face time goes: pure forward pass (input pre-staged on device)
vs the full analyze() (crop + to_tensor + transfer + forward + softmax + sync), on GPU
vs CPU, with cudnn.benchmark and fp16 variants.
"""
import time
import numpy as np
import torch

from liveness import LivenessDetector


def bench_forward(net, device, n=300):
    x = torch.rand(1, 3, 80, 80, device=device) * 255.0
    net = net.eval()
    with torch.no_grad():
        for _ in range(20):
            net(x)
        if device.type == "cuda":
            torch.cuda.synchronize()
        t0 = time.perf_counter()
        for _ in range(n):
            net(x)
        if device.type == "cuda":
            torch.cuda.synchronize()
    return (time.perf_counter() - t0) / n * 1000


def bench_analyze(det, n=300):
    img = (np.random.rand(300, 240, 3) * 255).astype(np.uint8)  # ~ a person crop
    bbox = (60, 60, 180, 220)
    for _ in range(20):
        det.analyze(img, bbox)
    if det.device.type == "cuda":
        torch.cuda.synchronize()
    t0 = time.perf_counter()
    for _ in range(n):
        det.analyze(img, bbox)
    if det.device.type == "cuda":
        torch.cuda.synchronize()
    return (time.perf_counter() - t0) / n * 1000


def main():
    cuda = torch.device("cuda")
    cpu = torch.device("cpu")
    print("=" * 64)
    print("PAD MICRO-BENCHMARK  (per face, ms)")
    print("=" * 64)

    det_gpu = LivenessDetector(ensemble=True, device=cuda)
    det_cpu = LivenessDetector(ensemble=True, device=cpu)
    net0_gpu = det_gpu.models[0].net   # MiniFASNetV2 (lightest, single)

    print("\n-- pure forward pass (input already on device) --")
    print(f"  GPU fp32, 1 model : {bench_forward(net0_gpu, cuda):6.2f}")
    torch.backends.cudnn.benchmark = True
    print(f"  GPU fp32 +cudnn.bm: {bench_forward(net0_gpu, cuda):6.2f}")
    torch.backends.cudnn.benchmark = False
    print(f"  CPU fp32, 1 model : {bench_forward(det_cpu.models[0].net, cpu):6.2f}")

    print("\n-- full analyze() (crop+transfer+forward+softmax+sync) --")
    print(f"  GPU ensemble (2)  : {bench_analyze(det_gpu):6.2f}")
    print(f"  CPU ensemble (2)  : {bench_analyze(det_cpu):6.2f}")
    det_gpu_1 = LivenessDetector(ensemble=False, device=cuda)
    det_cpu_1 = LivenessDetector(ensemble=False, device=cpu)
    print(f"  GPU single   (1)  : {bench_analyze(det_gpu_1):6.2f}")
    print(f"  CPU single   (1)  : {bench_analyze(det_cpu_1):6.2f}")
    print("=" * 64)


if __name__ == "__main__":
    main()
