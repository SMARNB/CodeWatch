import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from api.models import ViolationLog, Notification

DRESS_CODE_KEYWORDS = (
    'dress', 'shirt', 'uniform', 'attire', 'cloth', 'tie',
    'jacket', 'coat', 'vest', 'outfit', 'apparel', 'sleeve',
    'shorts', 'pant', 'trouser', 'shoe', 'sandal', 'cap', 'hat',
)

def normalize_violation_category(v_type):
    t = (v_type or '').strip().lower()
    if any(k in t for k in DRESS_CODE_KEYWORDS):
        return 'dress_code'
    return t

# Show every label and how it's categorized — paste this to verify coverage
print("Violation types found (raw -> category):")
for t in sorted({(x or 'None') for x in ViolationLog.objects.values_list('violation_type', flat=True)}):
    print(f"  {t!r:35} -> {normalize_violation_category(t)}")

print("\nScanning for duplicates...")
seen = set()
to_delete = []
for v in ViolationLog.objects.all().order_by('timestamp').values('id', 'person_id', 'violation_type', 'timestamp'):
    key = (v['person_id'], normalize_violation_category(v['violation_type']), v['timestamp'].date())
    if key in seen:
        to_delete.append(v['id'])
    else:
        seen.add(key)

print(f"Total violations:             {ViolationLog.objects.count()}")
print(f"Unique (person/category/day): {len(seen)}")
print(f"Duplicates to remove:         {len(to_delete)}")

BATCH = 2000
for i in range(0, len(to_delete), BATCH):
    chunk = to_delete[i:i + BATCH]
    Notification.objects.filter(violation_log_id__in=chunk).delete()
    ViolationLog.objects.filter(id__in=chunk).delete()
    print(f"  removed {min(i + BATCH, len(to_delete))}/{len(to_delete)}")

print(f"Remaining violations:         {ViolationLog.objects.count()}")
print("Done.")
