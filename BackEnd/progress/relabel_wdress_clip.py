"""
relabel_wdress_clip.py — CLIP zero-shot relabel of the broad `w-dress` class (id 7) into
modest (keep id 7) vs western/revealing (-> id 15, `w-western-dress`).

Admin's boundary (locked this session):
  COMPLIANT (modest)  = sleeved AND ankle/floor-length AND torso covered (no belly, no deep cleavage)
  VIOLATION (western) = sleeveless  OR  shorter-than-ankle  OR  belly/cleavage exposed

We encode that rule as THREE independent attribute checks (sleeve, length, torso). A dress is
flagged western if ANY trigger fires (faithful to the OR rule). Each check is a 2-group CLIP
softmax (violation-prompt-mean vs compliant-prompt-mean).

DRY-RUN by default: writes a per-box CSV + an annotated spot-check montage to
`dresscode_test/_relabel/` and prints summary counts. NOTHING is changed until you pass --apply,
which first backs up every split's `labels/` to `labels_backup_pre_v3/` then rewrites id 7 -> 15
for the western boxes (box coords untouched).

Usage (sandbox venv):
  venv\\Scripts\\python.exe relabel_wdress_clip.py
      [--split all|train|valid|test] [--model ViT-B-32] [--pretrained laion2b_s34b_b79k]
      [--thresh 0.60] [--margin 0.10] [--montage 120] [--pad 0.06] [--seed 0] [--apply]
"""
import os, sys, csv, glob, random, argparse, shutil
import numpy as np
import cv2
from PIL import Image
import torch
import open_clip

MODEST_CLS = 7          # keep
WESTERN_CLS = 15        # new: w-western-dress
DATASET = "FYP.v5i.yolo26"
OUT_DIR = os.path.join("dresscode_test", "_relabel")
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

# --- Attribute prompt sets (violation side first, compliant side second) ------------------
ATTRS = {
    "sleeve": {
        "violation": ["a sleeveless dress", "a dress with bare shoulders and bare arms",
                      "a strapless dress", "a spaghetti-strap dress", "a tank-style dress with bare arms"],
        "compliant": ["a dress with long sleeves", "a dress with full sleeves covering the arms",
                      "a long-sleeve dress", "a dress with sleeves covering the shoulders"],
    },
    "length": {
        "violation": ["a short dress above the knees", "a mini dress", "a knee-length dress",
                      "a dress showing bare legs", "a thigh-length short dress"],
        "compliant": ["a long floor-length dress", "an ankle-length maxi dress",
                      "a full-length gown covering the legs", "a long dress reaching the floor"],
    },
    "torso": {
        "violation": ["a dress showing the bare belly", "a crop-top dress with bare midriff",
                      "a low-cut dress showing cleavage", "a dress with a deep neckline showing the chest",
                      "a backless dress"],
        "compliant": ["a dress with a modest high neckline", "a dress fully covering the chest and stomach",
                      "a modest dress covering the neckline and midriff"],
    },
}


def build_image_index(img_dir):
    idx = {}
    for ext in IMG_EXTS:
        for p in glob.glob(os.path.join(img_dir, "*" + ext)):
            idx[os.path.splitext(os.path.basename(p))[0]] = p
    return idx


@torch.no_grad()
def encode_group(model, tokenizer, prompts, device):
    toks = tokenizer(prompts).to(device)
    feats = model.encode_text(toks)
    feats = feats / feats.norm(dim=-1, keepdim=True)
    mean = feats.mean(dim=0)
    return mean / mean.norm()


def yolo_to_xyxy(cx, cy, bw, bh, W, H, pad):
    x1 = (cx - bw / 2 - pad * bw) * W
    y1 = (cy - bh / 2 - pad * bh) * H
    x2 = (cx + bw / 2 + pad * bw) * W
    y2 = (cy + bh / 2 + pad * bh) * H
    return (max(0, int(x1)), max(0, int(y1)), min(W, int(x2)), min(H, int(y2)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", default="all", choices=["all", "train", "valid", "test"])
    ap.add_argument("--model", default="ViT-B-32")
    ap.add_argument("--pretrained", default="laion2b_s34b_b79k")
    ap.add_argument("--thresh", type=float, default=0.60)   # violation-side prob to flag an attribute
    ap.add_argument("--margin", type=float, default=0.10)   # +/- band around thresh => "review"
    ap.add_argument("--montage", type=int, default=120)
    ap.add_argument("--pad", type=float, default=0.06)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    random.seed(args.seed)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading CLIP {args.model}/{args.pretrained} on {device} ...")
    model, _, preprocess = open_clip.create_model_and_transforms(args.model, pretrained=args.pretrained)
    model = model.to(device).eval()
    tokenizer = open_clip.get_tokenizer(args.model)
    logit_scale = model.logit_scale.exp().item()

    # group-mean text vectors per attribute: tensor (2, D) -> [violation, compliant]
    attr_vecs = {}
    for name, sides in ATTRS.items():
        v = encode_group(model, tokenizer, sides["violation"], device)
        c = encode_group(model, tokenizer, sides["compliant"], device)
        attr_vecs[name] = torch.stack([v, c], dim=0)

    splits = ["train", "valid", "test"] if args.split == "all" else [args.split]
    os.makedirs(OUT_DIR, exist_ok=True)

    records = []            # one per w-dress box
    crops_pil, crops_bgr = [], []
    for sp in splits:
        lbl_dir = os.path.join(DATASET, sp, "labels")
        img_dir = os.path.join(DATASET, sp, "images")
        if not os.path.isdir(lbl_dir):
            print(f"  (skip {sp}: no labels dir)"); continue
        img_index = build_image_index(img_dir)
        for lf in glob.glob(os.path.join(lbl_dir, "*.txt")):
            stem = os.path.splitext(os.path.basename(lf))[0]
            lines = open(lf).read().splitlines()
            cls7 = [(li, ln.split()) for li, ln in enumerate(lines)
                    if len(ln.split()) >= 5 and ln.split()[0] == str(MODEST_CLS)]
            if not cls7:
                continue
            img_path = img_index.get(stem)
            img = cv2.imread(img_path) if img_path else None
            for li, t in cls7:
                cx, cy, bw, bh = map(float, t[1:5])
                rec = {"split": sp, "label": lf, "line": li, "stem": stem,
                       "bbox": (cx, cy, bw, bh), "ok": False}
                if img is not None:
                    H, W = img.shape[:2]
                    x1, y1, x2, y2 = yolo_to_xyxy(cx, cy, bw, bh, W, H, args.pad)
                    if x2 - x1 >= 8 and y2 - y1 >= 8:
                        crop = img[y1:y2, x1:x2]
                        crops_bgr.append(crop)
                        crops_pil.append(Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
                        rec["ok"] = True
                        rec["cidx"] = len(crops_pil) - 1
                records.append(rec)

    n_ok = sum(1 for r in records if r["ok"])
    print(f"w-dress boxes found: {len(records)}  | crops usable: {n_ok}")
    if n_ok == 0:
        print("No usable crops — aborting."); sys.exit(1)

    # --- batch CLIP encode crops + score the three attributes ---
    probs = {k: np.zeros(n_ok, dtype=np.float32) for k in ATTRS}   # violation-side prob
    bs = 64
    with torch.no_grad():
        for i in range(0, n_ok, bs):
            batch = torch.stack([preprocess(crops_pil[j]) for j in range(i, min(i + bs, n_ok))]).to(device)
            feats = model.encode_image(batch)
            feats = feats / feats.norm(dim=-1, keepdim=True)
            for name, tv in attr_vecs.items():
                logits = logit_scale * feats @ tv.t()          # (B,2)
                p = logits.softmax(dim=-1)[:, 0].float().cpu().numpy()  # violation prob
                probs[name][i:min(i + bs, n_ok)] = p

    # --- decide per box ---
    thr, mar = args.thresh, args.margin
    n_west = n_mod = n_review = 0
    for r in records:
        if not r["ok"]:
            r.update(decision="modest", reason="unreadable->keep", review=True,
                     p_sleeve=0, p_len=0, p_torso=0)
            n_mod += 1; n_review += 1
            continue
        ci = r["cidx"]
        ps, pl, pt = float(probs["sleeve"][ci]), float(probs["length"][ci]), float(probs["torso"][ci])
        triggers = []
        if ps >= thr: triggers.append(f"sleeveless({ps:.2f})")
        if pl >= thr: triggers.append(f"short({pl:.2f})")
        if pt >= thr: triggers.append(f"exposed({pt:.2f})")
        decision = "western" if triggers else "modest"
        near = any(abs(x - thr) <= mar for x in (ps, pl, pt))
        r.update(decision=decision, reason=",".join(triggers) or "modest",
                 review=near, p_sleeve=ps, p_len=pl, p_torso=pt)
        if decision == "western": n_west += 1
        else: n_mod += 1
        if near: n_review += 1

    # --- CSV report ---
    csv_path = os.path.join(OUT_DIR, "relabel_decisions.csv")
    with open(csv_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["split", "stem", "line", "decision", "p_sleeveless", "p_short", "p_exposed", "reason", "review"])
        for r in records:
            w.writerow([r["split"], r["stem"], r["line"], r["decision"],
                        f"{r['p_sleeve']:.3f}", f"{r['p_len']:.3f}", f"{r['p_torso']:.3f}",
                        r["reason"], int(r["review"])])

    print(f"\n=== DRY-RUN SUMMARY (thresh={thr}, margin={mar}) ===")
    print(f"  western (-> 15): {n_west}")
    print(f"  modest  (keep 7): {n_mod}")
    print(f"  near-threshold (review): {n_review}")
    print(f"  CSV: {csv_path}")

    # --- spot-check montage: stratified sample (top-western, top-modest, near-threshold) ---
    usable = [r for r in records if r["ok"]]
    west = sorted([r for r in usable if r["decision"] == "western"],
                  key=lambda r: -max(r["p_sleeve"], r["p_len"], r["p_torso"]))
    mod = sorted([r for r in usable if r["decision"] == "modest"],
                 key=lambda r: max(r["p_sleeve"], r["p_len"], r["p_torso"]))
    rev = [r for r in usable if r["review"]]
    n = args.montage
    pick = (west[:n // 3] + mod[:n // 3] + random.sample(rev, min(len(rev), n - 2 * (n // 3))))
    random.shuffle(pick)
    if pick:
        cols = 6
        cw, ch = 170, 250
        rows = (len(pick) + cols - 1) // cols
        canvas = np.full((rows * ch, cols * cw, 3), 30, np.uint8)
        for i, r in enumerate(pick):
            crop = crops_bgr[r["cidx"]]
            ar = crop.shape[1] / max(1, crop.shape[0])
            tw = min(cw - 8, int((ch - 46) * ar)); tw = max(8, tw)
            th = ch - 46
            thumb = cv2.resize(crop, (tw, th))
            ry, rx = (i // cols) * ch, (i % cols) * cw
            canvas[ry:ry + th, rx:rx + tw] = thumb
            col = (60, 60, 220) if r["decision"] == "western" else (60, 160, 60)
            tag = "W" if r["decision"] == "western" else "M"
            cv2.putText(canvas, f"{tag} {r['reason'][:18]}", (rx + 2, ry + th + 16),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, col, 1)
            cv2.putText(canvas, f"sl{r['p_sleeve']:.2f} ln{r['p_len']:.2f} to{r['p_torso']:.2f}",
                        (rx + 2, ry + th + 34), cv2.FONT_HERSHEY_SIMPLEX, 0.34, (210, 210, 210), 1)
        mpath = os.path.join(OUT_DIR, "relabel_montage.jpg")
        cv2.imwrite(mpath, canvas)
        print(f"  Montage ({len(pick)} crops): {mpath}")

    # --- apply (optional) ---
    if not args.apply:
        print("\nDRY-RUN only. Inspect the montage/CSV, then re-run with --apply to rewrite labels.")
        return

    print("\n--apply set: backing up labels and rewriting 7 -> 15 for western boxes ...")
    west_by_file = {}
    for r in records:
        if r["decision"] == "western" and r["ok"]:
            west_by_file.setdefault(r["label"], set()).add(r["line"])
    # back up each split's labels dir once
    for sp in splits:
        ld = os.path.join(DATASET, sp, "labels")
        bak = os.path.join(DATASET, sp, "labels_backup_pre_v3")
        if os.path.isdir(ld) and not os.path.isdir(bak):
            shutil.copytree(ld, bak)
            print(f"  backed up {ld} -> {bak}")
    changed_files = changed_boxes = 0
    for lf, line_set in west_by_file.items():
        lines = open(lf).read().splitlines()
        for li in line_set:
            t = lines[li].split()
            if t and t[0] == str(MODEST_CLS):
                t[0] = str(WESTERN_CLS)
                lines[li] = " ".join(t)
                changed_boxes += 1
        with open(lf, "w") as f:
            f.write("\n".join(lines) + ("\n" if lines else ""))
        changed_files += 1
    print(f"  rewrote {changed_boxes} boxes in {changed_files} files -> id {WESTERN_CLS} (w-western-dress)")


if __name__ == "__main__":
    main()
