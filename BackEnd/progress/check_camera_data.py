"""
Read-only diagnostic for the Analytics camera filter.
Save in your BackEnd folder (next to manage.py) and run:
    python check_camera_data.py
It only READS the database and changes nothing.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from django.db.models import Q, Count
from api.models import Camera, ViolationLog, MovementLog, TrackedPerson


def hr(ch='-', n=64):
    print(ch * n)


def main():
    print()
    hr('=')
    print(" CODE WATCH - CAMERA FILTER DIAGNOSTIC (read-only)")
    hr('=')

    # 1. Cameras
    print("\n[1] CAMERAS")
    hr()
    cams = list(Camera.objects.all())
    if not cams:
        print("  (no cameras in the database)")
    for cam in cams:
        print(f"  {cam.camera_id:<14}{cam.name:<22}active={cam.is_active}")

    # 2. Violation logs
    print("\n[2] VIOLATION LOGS (does each one record its camera?)")
    hr()
    v_total = ViolationLog.objects.count()
    v_with = ViolationLog.objects.exclude(camera__isnull=True).count()
    print(f"  total rows         : {v_total}")
    print(f"  with a camera set  : {v_with}")
    print(f"  with NO camera     : {v_total - v_with}")
    by_cam = (ViolationLog.objects.exclude(camera__isnull=True)
              .values('camera__camera_id', 'camera__name')
              .annotate(n=Count('id')).order_by('-n'))
    if by_cam:
        print("  by camera:")
        for r in by_cam:
            print(f"    {r['camera__camera_id']:<14}({r['camera__name']}) -> {r['n']}")

    # 3. Movement logs
    print("\n[3] MOVEMENT LOGS (does each one record its camera?)")
    hr()
    m_total = MovementLog.objects.count()
    m_fk = MovementLog.objects.exclude(camera__isnull=True).count()
    m_name = (MovementLog.objects
              .exclude(camera_name__isnull=True).exclude(camera_name='').count())
    print(f"  total rows         : {m_total}")
    print(f"  with camera FK     : {m_fk}")
    print(f"  with camera_name   : {m_name}")
    by_name = (MovementLog.objects.exclude(camera_name='')
               .values('camera_name').annotate(n=Count('id')).order_by('-n'))
    if by_name:
        print("  by camera_name:")
        for r in by_name:
            print(f"    {r['camera_name']:<24} -> {r['n']}")

    # 4. Simulated filter
    print("\n[4] WHAT THE PAGE WOULD SHOW PER CAMERA")
    print("    (mirrors get_analytics_data with a camera selected)")
    hr()
    for cam in cams:
        cid = cam.camera_id
        v_logs = ViolationLog.objects.filter(camera__camera_id=cid)
        violators = v_logs.values('person').distinct().count()
        seen = set(MovementLog.objects.filter(
            Q(camera__camera_id=cid) | Q(camera_name__iexact=cam.name)
        ).values_list('person_id', flat=True))
        seen |= set(v_logs.values_list('person_id', flat=True))
        total = len(seen)
        visitors = TrackedPerson.objects.filter(id__in=seen, role__iexact='visitor').count()
        print(f"\n  {cid} ({cam.name}):")
        print(f"    people seen   : {total}")
        print(f"    violators     : {violators}")
        print(f"    non-violators : {total - violators}")
        print(f"    visitors      : {visitors}")
        if total == 0 and violators == 0:
            print("    >> ALL ZEROS for this camera")

    # Verdict
    print()
    hr('=')
    print(" VERDICT")
    hr('=')
    if v_total == 0:
        print("  No violations exist yet -- create some, then re-run.")
    elif v_with == 0:
        print("  Violations exist but NONE record a camera.")
        print("  => Filtering by camera will show 0 violations everywhere.")
        print("  => Fix: stamp ViolationLog.camera at write-time")
        print("     (in log_violation / wherever violations are created).")
    else:
        print(f"  {v_with}/{v_total} violations carry a camera -> the filter WILL")
        print("  show real data for the cameras in section [2].")
    print()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        import traceback
        print("\n!! Diagnostic failed:")
        traceback.print_exc()
        print("\nIf this is a settings error, open manage.py and copy the")
        print("DJANGO_SETTINGS_MODULE value into the top of this script.")
