"""
inspect_relabel.py — build readable, decision-separated montages from relabel_decisions.csv
so we can eyeball CLIP's calls before applying. No CLIP needed (re-crops from images using the
still-unmodified label files).

  venv\\Scripts\\python.exe inspect_relabel.py
Outputs to dresscode_test/_relabel/: western_hi.jpg, modest_hi.jpg, borderline.jpg
"""
import os, csv, cv2, numpy as np

DATASET = "FYP.v5i.yolo26"
OUT = os.path.join("dresscode_test", "_relabel")
PAD = 0.06
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")


def find_img(split, stem):
    d = os.path.join(DATASET, split, "images")
    for e in IMG_EXTS:
        p = os.path.join(d, stem + e)
        if os.path.exists(p):
            return p
    return None


def crop_for(row):
    img_path = find_img(row["split"], row["stem"])
    if not img_path:
        return None
    img = cv2.imread(img_path)
    if img is None:
        return None
    lf = os.path.join(DATASET, row["split"], "labels", row["stem"] + ".txt")
    lines = open(lf).read().splitlines()
    t = lines[int(row["line"])].split()
    cx, cy, bw, bh = map(float, t[1:5])
    H, W = img.shape[:2]
    x1 = max(0, int((cx - bw / 2 - PAD * bw) * W)); y1 = max(0, int((cy - bh / 2 - PAD * bh) * H))
    x2 = min(W, int((cx + bw / 2 + PAD * bw) * W)); y2 = min(H, int((cy + bh / 2 + PAD * bh) * H))
    return img[y1:y2, x1:x2]


def montage(rows, path, cols=4, tw=300, th=400):
    rows = rows[:cols * ((len(rows) + cols - 1) // cols)]
    n = len(rows); nr = (n + cols - 1) // cols
    lab = 54
    canvas = np.full((nr * (th + lab), cols * tw, 3), 25, np.uint8)
    for i, r in enumerate(rows):
        c = crop_for(r)
        if c is None:
            continue
        ar = c.shape[1] / max(1, c.shape[0])
        w = min(tw - 8, int(th * ar)); w = max(8, w)
        thumb = cv2.resize(c, (w, th))
        ry = (i // cols) * (th + lab); rx = (i % cols) * tw
        canvas[ry:ry + th, rx:rx + w] = thumb
        west = r["decision"] == "western"
        col = (60, 60, 230) if west else (60, 180, 60)
        cv2.putText(canvas, ("WESTERN" if west else "MODEST"), (rx + 4, ry + th + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, col, 2)
        cv2.putText(canvas, f"sl{float(r['p_sleeveless']):.2f} sh{float(r['p_short']):.2f} ex{float(r['p_exposed']):.2f}",
                    (rx + 4, ry + th + 46), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (210, 210, 210), 1)
    cv2.imwrite(path, canvas)
    print(f"  {os.path.basename(path)}: {n} crops")


rows = list(csv.DictReader(open(os.path.join(OUT, "relabel_decisions.csv"))))
for r in rows:
    r["maxp"] = max(float(r["p_sleeveless"]), float(r["p_short"]), float(r["p_exposed"]))

west = sorted([r for r in rows if r["decision"] == "western"], key=lambda r: -r["maxp"])
mod = sorted([r for r in rows if r["decision"] == "modest"], key=lambda r: r["maxp"])
border = sorted([r for r in rows if r["review"] == "1"], key=lambda r: abs(r["maxp"] - 0.60))

print("Building montages...")
montage(west[:16], os.path.join(OUT, "western_hi.jpg"))     # most confident westerns -> should look revealing
montage(mod[:16], os.path.join(OUT, "modest_hi.jpg"))       # most confident modests -> should look covered/long
montage(border[:16], os.path.join(OUT, "borderline.jpg"))   # the uncertain band
print("done")
