"""Per-class validation of dresscode_v3 (GPU, no DataLoader workers -> Windows-safe)."""
from ultralytics import YOLO

if __name__ == "__main__":
    m = YOLO(r"runs\detect\dresscode_runs\codewatch_dresscode_v3\weights\best.pt")
    r = m.val(data=r"FYP.v5i.yolo26/data.yaml", split="val", device=0, workers=0, verbose=False)
    names = m.names
    print(f"\n{'class':22s} {'mAP50':>7s} {'mAP50-95':>9s}")
    print("-" * 42)
    for i, c in enumerate(names.values()):
        print(f"{c:22s} {r.box.ap50[i]:7.3f} {r.box.maps[i]:9.3f}")
    print("-" * 42)
    print(f"{'ALL (mean)':22s} {r.box.map50:7.3f} {r.box.map:9.3f}")
