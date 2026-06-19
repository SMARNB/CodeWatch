"""
Run the dress-code model on a folder of images and show EXACTLY what CodeWatch would decide,
using the same logic as FinalSystem.py + the live admin-editable policy (DressCodeRule).

Usage:
    venv\\Scripts\\python.exe run_dresscode_test.py [folder] [--conf 0.5]
Default folder: dresscode_test/   (drop your test images there)
Annotated copies are written to <folder>/_results/.
"""
import os, sys, glob
import cv2
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()
from api.models import DressCodeRule
from ultralytics import YOLO

folder = 'dresscode_test'
conf = 0.5
args = sys.argv[1:]
for i, a in enumerate(args):
    if a == '--conf' and i + 1 < len(args):
        conf = float(args[i + 1])
    elif not a.startswith('--') and (i == 0 or args[i - 1] != '--conf'):
        folder = a

out_dir = os.path.join(folder, '_results')
os.makedirs(out_dir, exist_ok=True)

# --- Load the live policy exactly like FinalSystem.load_dresscode_policy() ---
rules = list(DressCodeRule.objects.all())
status_of = {r.clothing_class: r.status for r in rules}
VIOLATION_MALE = {r.clothing_class for r in rules if r.status == 'violation' and r.gender in ('male', 'any')}
VIOLATION_FEMALE = {r.clothing_class for r in rules if r.status == 'violation' and r.gender in ('female', 'any')}

DRESSCODE_MODEL_PATH = os.path.join('runs', 'detect', 'dresscode_runs', 'codewatch_dresscode_v3', 'weights', 'best.pt')
model = YOLO(DRESSCODE_MODEL_PATH)

COLOR = {'violation': (0, 0, 220), 'compliant': (0, 150, 0), 'neutral': (130, 130, 130)}

paths = []
for ext in ('*.jpg', '*.jpeg', '*.png', '*.webp', '*.bmp'):
    paths += glob.glob(os.path.join(folder, ext))
paths = [p for p in paths if '_results' not in p]

if not paths:
    print(f"\n(No images in '{folder}/'. Drop your test images there and re-run.)")
    sys.exit(0)

print(f"\nPolicy in use: VIOLATION_MALE={sorted(VIOLATION_MALE)}  VIOLATION_FEMALE={sorted(VIOLATION_FEMALE)}")
print("=" * 78)

for p in sorted(paths):
    img = cv2.imread(p)
    if img is None:
        print(f"\n{os.path.basename(p)}: could not read"); continue
    res = model(img, conf=conf, verbose=False)
    detected = []
    for r in res:
        for box in r.boxes:
            cls = model.names[int(box.cls[0].item())]
            c = float(box.conf[0].item())
            xy = box.xyxy[0].tolist()
            detected.append((cls, c, xy))

    names = [d[0] for d in detected]
    m_count = sum(1 for c in names if c.startswith('m-'))
    w_count = sum(1 for c in names if c.startswith('w-'))
    gender = 'male' if m_count >= w_count else 'female'
    vset = VIOLATION_MALE if gender == 'male' else VIOLATION_FEMALE
    violation_classes = [c for c in names if c in vset]
    verdict = 'DRESS-CODE VIOLATION' if violation_classes else 'compliant'

    print(f"\n{os.path.basename(p)}")
    if not detected:
        print("   detected: (nothing above conf threshold)")
    for cls, c, _ in sorted(detected, key=lambda d: -d[1]):
        st = status_of.get(cls, '??')
        flag = '  <-- counts as VIOLATION' if cls in vset else ''
        print(f"   {cls:18s} conf={c:.2f}  policy-status={st}{flag}")
    print(f"   inferred gender: {gender}   =>   VERDICT: {verdict}")

    # annotate
    for cls, c, xy in detected:
        st = status_of.get(cls, 'neutral')
        col = COLOR.get(st, (130, 130, 130))
        x1, y1, x2, y2 = map(int, xy)
        cv2.rectangle(img, (x1, y1), (x2, y2), col, 2)
        cv2.putText(img, f"{cls} {c:.2f} [{st}]", (x1, max(15, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 2)
    banner = (0, 0, 220) if violation_classes else (0, 150, 0)
    cv2.rectangle(img, (0, 0), (img.shape[1], 34), banner, -1)
    cv2.putText(img, f"{verdict} ({gender})", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.imwrite(os.path.join(out_dir, os.path.basename(p)), img)

print("\n" + "=" * 78)
print(f"Annotated images -> {out_dir}")
