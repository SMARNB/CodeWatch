"""CodeWatch API views — analytics domain (split from the monolithic api/views.py)."""
import os
import json
import re
import base64
import io
import cv2
import numpy as np
import redis
import secrets
import time
import calendar
from django.db.models.functions import TruncMonth, TruncDate, Lower

from django.contrib.auth import authenticate
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count, Q
from ..models import TrackedPerson, ViolationLog, Camera, IncidentReport, Notification, Violation, UserProfile, Blacklist, MovementLog, VisitorLog, DressCodeRule
from ..serializers import DressCodeRuleSerializer
from django.contrib.auth.models import User
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils.dateparse import parse_date
from django.utils import timezone
from datetime import timedelta
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from insightface.app import FaceAnalysis
from django.views.decorators.csrf import csrf_exempt
from django.core.paginator import Paginator
from rest_framework.decorators import permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.authtoken.models import Token

from .utils import (_rel_media, _MEDIA_ABS_RE, IsAdminRole, IsAdminOrSsdRole, _requester_scope, _auth_user_key_and_role, _person_scope_q, cosine_similarity, face_app, _person_embeddings)



# --- 2. DASHBOARD ENDPOINTS ---

@api_view(['GET'])
def get_recent_activity(request):
    """ Returns recent logs for tables. """
    logs = ViolationLog.objects.all().order_by('-timestamp')[:10]
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "timestamp": log.timestamp,
            "violation_type": log.violation_type,
            "person_name": log.person.name if log.person else "Unknown",
            "snapshot_url": log.snapshot_path.url if log.snapshot_path else None
        })
    return Response(data)

@api_view(['GET'])
def get_dashboard_stats(request):
    """ Real dashboard data: stat cards, people-by-category pie,
        12-month line, 6-month by-type trend, and 53-week heatmap. """
    from django.db.models import Count, Q
    from django.db.models.functions import TruncMonth, TruncDate
    from django.utils import timezone
    from datetime import timedelta
    from collections import defaultdict
    import calendar

    now = timezone.now()

    # Department-Head scoping: every query below runs over their department + unknowns.
    role, _dept = _requester_scope(request)
    _dh = (role == 'department-head')
    _P = TrackedPerson.objects.filter(_person_scope_q(_dept)) if _dh else TrackedPerson.objects
    _V = ViolationLog.objects.filter(_person_scope_q(_dept, 'person__')) if _dh else ViolationLog.objects

    # ---- Stat cards (all real) ----
    total_people = _P.count()
    total_violations = _V.count()
    violators = _P.filter(violationlog__isnull=False).distinct().count()
    non_violators_stat = total_people - violators

    # ---- Pie: tracked people by category (mutually exclusive) ----
    blacklisted = _P.filter(classification__iexact='blacklisted').count()
    visitors = _P.filter(classification__iexact='visitor').count()
    unauthorized = _P.filter(classification__iexact='unknown').count()
    remaining = _P.exclude(
        Q(classification__iexact='blacklisted') |
        Q(classification__iexact='visitor') |
        Q(classification__iexact='unknown')
    )
    dress_ids = set(remaining.filter(
        Q(classification__icontains='dress') |
        Q(violationlog__violation_type__icontains='dress')
    ).values_list('id', flat=True))
    dresscode = len(dress_ids)
    pie_non_violators = remaining.count() - dresscode

    pie_labels = ["Non-Violators", "Visitors", "Unauthorized", "Dress-Code", "Blacklisted"]
    pie_data = [pie_non_violators, visitors, unauthorized, dresscode, blacklisted]

    # ---- Last 12 calendar months, oldest -> newest ----
    seq = []
    yy, mm = now.year, now.month
    for _ in range(12):
        seq.append((yy, mm))
        mm -= 1
        if mm == 0:
            mm = 12
            yy -= 1
    seq.reverse()

    # ---- Line: total violations per month (last 12 months) ----
    month_map = {}
    for r in (_V
              .annotate(b=TruncMonth('timestamp'))
              .values('b')
              .annotate(count=Count('id'))):
        if r['b']:
            month_map[(r['b'].year, r['b'].month)] = r['count']
    line_labels = [calendar.month_abbr[m] for (y, m) in seq]
    line_data = [month_map.get((y, m), 0) for (y, m) in seq]

    # ---- Per-card trends (% vs last month + 6-month sparkline) ----
    vmonth = {}
    for r in (_V
              .annotate(b=TruncMonth('timestamp'))
              .values('b')
              .annotate(count=Count('person', distinct=True))):
        if r['b']:
            vmonth[(r['b'].year, r['b'].month)] = r['count']
    violators_series = [vmonth.get((y, m), 0) for (y, m) in seq]

    def _trend(series12):
        counts = list(series12 or [])
        if len(counts) < 2 or sum(counts) == 0:
            return '', []
        last, prev = counts[-1], counts[-2]
        if prev > 0:
            change = round((last - prev) / prev * 100)
            pct = f"{'+' if change >= 0 else ''}{change}%"
        else:
            pct = '+100%' if last > 0 else '0%'
        return pct, counts[-6:]

    unauth_pct, unauth_spark = _trend(line_data)
    viol_pct, viol_spark = _trend(violators_series)

    from django.core.exceptions import FieldError
    try:
        reg_month = {}
        for r in (_P
                  .annotate(b=TruncMonth('created_at'))
                  .values('b')
                  .annotate(count=Count('id'))):
            if r['b']:
                reg_month[(r['b'].year, r['b'].month)] = r['count']
        baseline = total_people - sum(reg_month.values())
        cum = baseline
        tracked_series = []
        for (y, m) in seq:
            cum += reg_month.get((y, m), 0)
            tracked_series.append(cum)
    except FieldError:
        tracked_series = [total_people] * len(seq)
    victors_pct, victors_spark = _trend(tracked_series)

    from django.db.models import Min
    first_v = {}
    for r in _V.values('person_id').annotate(f=Min('timestamp')):
        if r['f']:
            first_v[r['person_id']] = (r['f'].year, r['f'].month)
    fv_m = {}
    for ym in first_v.values():
        fv_m[ym] = fv_m.get(ym, 0) + 1
    vbase = violators - sum(fv_m.get((y, m), 0) for (y, m) in seq)
    vcum = vbase
    violators_cum = []
    for (y, m) in seq:
        vcum += fv_m.get((y, m), 0)
        violators_cum.append(vcum)
    nonviol_series = [max(t - v, 0) for t, v in zip(tracked_series, violators_cum)]
    nonviol_pct, nonviol_spark = _trend(nonviol_series)

    # ---- Trend: violations by TYPE per month (last 6 months) ----
    vtype_rows = (_V
                  .values('violation_type')
                  .annotate(c=Count('id'))
                  .order_by('-c'))
    vtype_labels = [(r['violation_type'] or 'Unknown') for r in vtype_rows]
    six = seq[-6:]
    trend_labels = [calendar.month_abbr[m] for (y, m) in six]
    by_type = defaultdict(dict)
    for r in (_V
              .annotate(b=TruncMonth('timestamp'))
              .values('b', 'violation_type')
              .annotate(count=Count('id'))):
        if r['b']:
            t = r['violation_type'] or 'Unknown'
            by_type[t][(r['b'].year, r['b'].month)] = r['count']
    palette = ['#7987FF', '#E697FF', '#FFA5CB', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']
    trend_datasets = []
    for i, t in enumerate(vtype_labels):
        trend_datasets.append({
            "label": t,
            "data": [by_type.get(t, {}).get((y, m), 0) for (y, m) in six],
            "color": palette[i % len(palette)],
        })

    # ---- Heatmap: 53-week grid, real daily intensity ----
    start_day = (now - timedelta(days=371)).date()
    day_map = {}
    for r in (_V
              .filter(timestamp__date__gte=start_day)
              .annotate(d=TruncDate('timestamp'))
              .values('d')
              .annotate(count=Count('id'))):
        if r['d']:
            day_map[r['d']] = r['count']
    timeline = []
    for week in range(53):
        for day in range(7):
            the_date = start_day + timedelta(days=week * 7 + day)
            c = day_map.get(the_date, 0)
            intensity = 0 if c == 0 else 1 if c <= 2 else 2 if c <= 5 else 3
            timeline.append({"week": week, "day": day, "intensity": intensity})

    return Response({
        "stats": {
            "nonViolators": {"value": non_violators_stat, "percentageChange": nonviol_pct, "miniChartData": nonviol_spark},
            "unauthorized": {"value": total_violations, "percentageChange": unauth_pct, "miniChartData": unauth_spark},
            "violators": {"value": violators, "percentageChange": viol_pct, "miniChartData": viol_spark},
            "victors": {"value": total_people, "percentageChange": victors_pct, "miniChartData": victors_spark},
        },
        "pie_chart": {"labels": pie_labels, "data": pie_data},
        "line": {"labels": line_labels, "data": line_data},
        "trend": {"labels": trend_labels, "datasets": trend_datasets, "total": total_violations},
        "timeline": timeline,
    })

# --- 3. ANALYTICS ENDPOINTS (THIS WAS MISSING!) ---

@api_view(['GET'])
def get_violation_stats(request):
    """ Returns top violators. """
    stats = TrackedPerson.objects.annotate(total=Count('violationlog')).order_by('-total')
    data = []
    for p in stats:
        if p.total > 0:
            data.append({
                "id": p.id,
                "name": p.name,
                "count": p.total,
                "last_seen": p.created_at
            })
    return Response(data)

@api_view(['GET'])
def get_analytics_filters(request):
    role, dept = _requester_scope(request)
    if role == 'department-head':
        departments = [dept] if dept else []
        roles = sorted({r for r in TrackedPerson.objects.values_list('role', flat=True) if r})
        return Response({"departments": departments, "roles": roles})
    departments = sorted({d for d in TrackedPerson.objects.values_list('department', flat=True) if d})
    roles = sorted({r for r in TrackedPerson.objects.values_list('role', flat=True) if r})
    return Response({"departments": departments, "roles": roles})

@api_view(['POST'])
def get_analytics_data(request):
    """
    Returns filtered counts for the Analytics Page.
    """
    filters = request.data
    
    # 1. Base Query
    people = TrackedPerson.objects.all()
    logs = ViolationLog.objects.all()

    # Department-Head scoping (forced — overrides any department filter sent by the client)
    role, _dept = _requester_scope(request)
    is_dept_head = (role == 'department-head')
    if is_dept_head:
        people = people.filter(_person_scope_q(_dept))
        logs = logs.filter(_person_scope_q(_dept, 'person__'))

    # 2. Apply Filters
    # Filter by Department (skipped for department-heads — already locked to their own)
    if not is_dept_head and filters.get('department') and len(filters['department']) > 0:
        people = people.filter(department__in=filters['department'])
        logs = logs.filter(person__department__in=filters['department'])

    # Filter by Gender (case-insensitive)
    if filters.get('gender') and len(filters['gender']) > 0:
        genders = [g.lower() for g in filters['gender']]
        people = people.annotate(_g=Lower('gender')).filter(_g__in=genders)
        logs = logs.annotate(_pg=Lower('person__gender')).filter(_pg__in=genders)

    # Filter by User Type / Role (case-insensitive)
    if filters.get('userType') and len(filters['userType']) > 0:
        roles = [r.lower() for r in filters['userType']]
        people = people.annotate(_r=Lower('role')).filter(_r__in=roles)
        logs = logs.annotate(_pr=Lower('person__role')).filter(_pr__in=roles)

    # Filter by Camera (scope everything to one camera's activity)
    camera_id = (filters.get('cameraId') or '').strip()
    if camera_id:
        from ..models import MovementLog, Camera
        from django.db.models import Q
        cam = Camera.objects.filter(camera_id=camera_id).first()
        cam_name = cam.name if cam else None

        # Violations recorded by this camera (ViolationLog has a camera FK)
        logs = logs.filter(camera__camera_id=camera_id)

        # People seen at this camera — movement logs key off the FK or the stored camera_name
        mv_q = Q(camera__camera_id=camera_id)
        if cam_name:
            mv_q |= Q(camera_name__iexact=cam_name)
        seen_ids = set(MovementLog.objects.filter(mv_q).values_list('person_id', flat=True))
        seen_ids |= set(ViolationLog.objects.filter(camera__camera_id=camera_id).values_list('person_id', flat=True))
        people = people.filter(id__in=seen_ids)

    logs_history = logs  # dept/role/gender applied, all dates — for the trend charts

    # Filter by Date
    if filters.get('startDate'):
        logs = logs.filter(timestamp__date__gte=parse_date(filters['startDate']))
    if filters.get('endDate'):
        logs = logs.filter(timestamp__date__lte=parse_date(filters['endDate']))

    # 3. Calculate Real Counts
    total_people = people.count()
    violators_count = logs.values('person').distinct().count()
    non_violators = total_people - violators_count
    
    # "Unauthorized" -> Let's count people with 'Unauthorized' violation type
    unauthorized = logs.filter(violation_type__icontains="Unauthorized").values('person').distinct().count()
    
    # "Visitors" -> Count people with role 'Visitor'
    visitors = people.filter(role__iexact="visitor").count()

    # "Victors" -> We'll map this to 'Total Tracked' for the demo
    victors = total_people

    today = timezone.localdate()

    # Monthly total violations (last 12 months)
    monthly_qs = logs_history.annotate(m=TruncMonth('timestamp')).values('m').annotate(c=Count('id'))
    month_map = {(r['m'].year, r['m'].month): r['c'] for r in monthly_qs if r['m']}
    buckets = []
    y, m = today.year, today.month
    for i in range(11, -1, -1):
        mm, yy = m - i, y
        while mm <= 0:
            mm += 12
            yy -= 1
        buckets.append((yy, mm))
    monthly_violations = [
        {"month": calendar.month_abbr[mm], "count": month_map.get((yy, mm), 0)}
        for (yy, mm) in buckets
    ]

    # Per-metric monthly series (last 12 months) so each stat card shows its OWN trend
    from ..models import VisitorLog

    def _metric_series(qs, date_field='timestamp'):
        rows = (qs.annotate(_mm=TruncMonth(date_field))
                  .values('_mm')
                  .annotate(_cc=Count('person', distinct=True)))
        mp = {(r['_mm'].year, r['_mm'].month): r['_cc'] for r in rows if r['_mm']}
        return [{"month": calendar.month_abbr[mm], "count": mp.get((yy, mm), 0)}
                for (yy, mm) in buckets]

    people_ids = list(people.values_list('id', flat=True))
    monthly_violators    = _metric_series(logs_history)
    monthly_unauthorized = _metric_series(logs_history.filter(violation_type__icontains="Unauthorized"))
    monthly_visitors     = _metric_series(VisitorLog.objects.filter(person_id__in=people_ids), date_field='check_in')

    # Non-Violators series = cumulative tracked people − cumulative distinct violators (filtered)
    from django.core.exceptions import FieldError
    from django.db.models import Min
    try:
        reg_m = {}
        for r in TrackedPerson.objects.filter(id__in=people_ids).annotate(_b=TruncMonth('created_at')).values('_b').annotate(_c=Count('id')):
            if r['_b']:
                reg_m[(r['_b'].year, r['_b'].month)] = r['_c']
        ppl_base = total_people - sum(reg_m.values())
        ppl_cum, ppl_series = ppl_base, []
        for (yy, mm) in buckets:
            ppl_cum += reg_m.get((yy, mm), 0)
            ppl_series.append(ppl_cum)
    except FieldError:
        ppl_series = [total_people] * len(buckets)

    flogs = ViolationLog.objects.filter(person_id__in=people_ids)
    total_violators_all = flogs.values('person_id').distinct().count()
    fv_m = {}
    for r in flogs.values('person_id').annotate(_f=Min('timestamp')):
        if r['_f']:
            key = (r['_f'].year, r['_f'].month)
            fv_m[key] = fv_m.get(key, 0) + 1
    vbase = total_violators_all - sum(fv_m.get((yy, mm), 0) for (yy, mm) in buckets)
    vcum, v_series = vbase, []
    for (yy, mm) in buckets:
        vcum += fv_m.get((yy, mm), 0)
        v_series.append(vcum)

    monthly_nonviolators = [
        {"month": calendar.month_abbr[mm], "count": max(ppl_series[i] - v_series[i], 0)}
        for i, (yy, mm) in enumerate(buckets)
    ]

    # Daily violations (last 53 weeks) -> heatmap grid
    start = today - timedelta(days=370)
    daily_qs = logs_history.filter(timestamp__date__gte=start).annotate(d=TruncDate('timestamp')).values('d').annotate(c=Count('id'))
    daily_counts = {r['d'].isoformat(): r['c'] for r in daily_qs if r['d']}
    timeline = []
    for week in range(53):
        for day in range(7):
            cell_date = start + timedelta(days=week * 7 + day)
            cnt = daily_counts.get(cell_date.isoformat(), 0)
            intensity = 0 if cnt == 0 else (1 if cnt < 3 else 2)
            timeline.append({
                "week": week, "day": day, "intensity": intensity,
                "hour": "12:00", "date": cell_date.isoformat(), "count": cnt
            })

    return Response({
        "nonViolators": non_violators,
        "violators": violators_count,
        "unauthorized": unauthorized,
        "visitors": visitors,
        "victors": victors,
        "monthlyViolations": monthly_violations,
        "monthlyViolators": monthly_violators,
        "monthlyUnauthorized": monthly_unauthorized,
        "monthlyVisitors": monthly_visitors,
        "monthlyNonViolators": monthly_nonviolators,
        "timelineData": timeline,
    })
