"""
Delete orphaned movement logs (rows whose camera was deleted, so the FK is NULL).
Run from BackEnd:  python clean_movement_logs.py
SAFE by default: DRY_RUN = True only reports. Set DRY_RUN = False to actually delete.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from django.db.models import Count
from api.models import MovementLog

DRY_RUN = False   # <-- set to False to actually delete

def main():
    orphans = MovementLog.objects.filter(camera__isnull=True)
    n = orphans.count()
    print(f"\nTotal movement rows : {MovementLog.objects.count()}")
    print(f"Orphaned (no camera): {n}")
    print("\nGrouped by stored camera_name:")
    for r in orphans.values('camera_name').annotate(c=Count('id')).order_by('-c'):
        print(f"  {r['camera_name']!r:24} -> {r['c']}")
    if DRY_RUN:
        print(f"\nDRY_RUN is True — nothing deleted. Set DRY_RUN = False and re-run to remove these {n} rows.")
    else:
        deleted, _ = orphans.delete()
        print(f"\nDeleted {deleted} rows. Remaining: {MovementLog.objects.count()}")

if __name__ == '__main__':
    main()
