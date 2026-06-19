"""CodeWatch API views — notifications domain (split from the monolithic api/views.py)."""
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


    
@api_view(['GET'])
def get_notifications(request):
    """ Notifications for the requesting user: per-user read/cleared state + role targeting. """
    import re
    from django.db.models import Q
    from ..models import NotificationState
    user_key, role = _auth_user_key_and_role(request)
    qs = Notification.objects.select_related('person', 'camera', 'violation_log').all().order_by('-timestamp')
    qs = qs.filter(Q(target_role__isnull=True) | Q(target_role='') | Q(target_role__iexact=role))

    # Department-Head scoping: only notifications about their department or unknowns.
    _scope_role, _scope_dept = _requester_scope(request)
    if _scope_role == 'department-head':
        qs = qs.filter(_person_scope_q(_scope_dept, 'person__'))
    cleared_ids, read_ids = set(), set()
    if user_key:
        cleared_ids = set(NotificationState.objects.filter(user_key=user_key, is_cleared=True).values_list('notification_id', flat=True))
        read_ids = set(NotificationState.objects.filter(user_key=user_key, is_read=True).values_list('notification_id', flat=True))

    def categorize(n):
        title_l = (n.title or '').lower()
        if 'password reset' in title_l or n.notif_type == 'password_reset':
            return 'password_reset'
        cls = ((n.person.classification if n.person else '') or '').lower()
        if cls == 'blacklisted':
            return 'blacklisted'
        vtype = ((n.violation_log.violation_type if n.violation_log else '') or '').lower()
        if 'dress' in vtype:
            return 'dress_code'
        if cls == 'unknown':
            return 'unknown'
        if (n.notif_type or '') == 'security':
            return 'unknown'
        return 'default'

    data = []
    for n in qs:
        if n.id in cleared_ids:
            continue
        vid = n.violation_log.id if n.violation_log else None
        message = f"{n.message} · Violation #{vid}" if vid else n.message
        category = categorize(n)
        reset_email = None
        if category == 'password_reset':
            m = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', n.message or '')
            reset_email = m.group(0) if m else None
        data.append({
            "id": n.id,
            "title": n.title,
            "message": message,
            "type": n.notif_type,
            "category": category,
            "reset_email": reset_email,
            "is_read": (n.id in read_ids),
            "time": n.timestamp.strftime("%b %d, %I:%M %p"),
            "person_id": n.person.id if n.person else None,
            "person_name": n.person.name if n.person else None,
            "person_classification": n.person.classification if n.person else None,
            "person_employee_id": n.person.employee_id if n.person else None,
            "person_department": n.person.department if n.person else None,
            "person_role": n.person.role if n.person else None,
            "camera_id": n.camera.camera_id if n.camera else None,
            "camera_name": n.camera.name if n.camera else None,
            "violation_id": vid,
            "violation_type": n.violation_log.violation_type if n.violation_log else None,
        })
    return Response(data)

@api_view(['POST'])
def mark_notif_read(request, notif_id):
    """ Marks one notification read for THIS user only. """
    from ..models import NotificationState
    user_key, _ = _auth_user_key_and_role(request)
    if not user_key:
        return Response({"status": "error", "message": "No user provided."}, status=400)
    try:
        n = Notification.objects.get(id=notif_id)
    except Notification.DoesNotExist:
        return Response({"status": "error", "message": "Notification not found"}, status=404)
    NotificationState.objects.update_or_create(user_key=user_key, notification=n, defaults={'is_read': True})
    return Response({"status": "success"})

@api_view(['POST'])
def mark_all_notifications_read(request):
    """ Marks all notifications visible to THIS user as read, for this user only. """
    from django.db.models import Q
    from ..models import NotificationState
    user_key, role = _auth_user_key_and_role(request)
    if not user_key:
        return Response({"status": "error", "message": "No user provided."}, status=400)
    visible = Notification.objects.filter(Q(target_role__isnull=True) | Q(target_role='') | Q(target_role__iexact=role))
    for n in visible:
        NotificationState.objects.update_or_create(user_key=user_key, notification=n, defaults={'is_read': True})
    return Response({"status": "success"})

@api_view(['POST'])
def clear_notifications(request):
    """ Per-user clear. mode='read' clears only the ones THIS user has viewed; mode='all'
        clears everything visible to this user. Nothing is deleted — just hidden for this user. """
    from django.db.models import Q
    from ..models import NotificationState
    user_key, role = _auth_user_key_and_role(request)
    mode = (request.query_params.get('mode') or request.data.get('mode') or 'all').lower()

    if not user_key:
        return Response({"status": "error", "message": "No user provided."}, status=400)

    visible = Notification.objects.filter(Q(target_role__isnull=True) | Q(target_role='') | Q(target_role__iexact=role))
    if mode == 'read':
        read_ids = list(NotificationState.objects.filter(user_key=user_key, is_read=True).values_list('notification_id', flat=True))
        target = visible.filter(id__in=read_ids)
    else:
        target = visible

    cleared = 0
    for n in target:
        NotificationState.objects.update_or_create(user_key=user_key, notification=n, defaults={'is_cleared': True})
        cleared += 1
    return Response({"status": "success", "mode": mode, "cleared": cleared})

@api_view(['GET'])
def get_notification_detail(request, pk):
    """ Returns a single notification with related violation events. """
    try:
        notif = Notification.objects.get(pk=pk)
        
        person_details = None
        if notif.person:
            person_details = {
                "name": notif.person.name,
                "employee_id": notif.person.employee_id,
                "classification": notif.person.classification,
                "profile_picture": notif.person.profile_picture.url if notif.person.profile_picture else None
            }
            
        camera_details = None
        if notif.camera:
            camera_details = {
                "camera_id": notif.camera.camera_id,
                "name": notif.camera.name,
                "location": notif.camera.location,
                "stream_url": notif.camera.stream_url
            }
            
        violation_details = None
        if notif.violation_log:
            violation_details = {
                "type": notif.violation_log.violation_type,
                "timestamp": notif.violation_log.timestamp,
                "confidence": notif.violation_log.confidence,
                "snapshot_url": notif.violation_log.snapshot_path.url if bool(notif.violation_log.snapshot_path) else None
            }

        data = {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "type": notif.notif_type,
            "is_read": notif.is_read,
            "timestamp": notif.timestamp,
            "person_id": notif.person.id if notif.person else None,
            "camera_id": notif.camera.camera_id if notif.camera else None,
            "violation_log_id": notif.violation_log.id if notif.violation_log else None,
            "person_details": person_details,
            "camera_details": camera_details,
            "violation_details": violation_details
        }
        return Response(data)
    except Notification.DoesNotExist:
        return Response(status=404)



@api_view(['GET'])
def get_violation_events(request, pk):
    """ Returns violation events for a specific notification. """
    try:
        notif = Notification.objects.get(pk=pk)
        notif_date = notif.timestamp.date()
        recent_logs = ViolationLog.objects.filter(timestamp__date=notif_date).order_by('-timestamp')[:10]
        
        events = []
        for log in recent_logs:
            events.append({
                "id": log.id,
                "type": log.violation_type, 
                "title": f"Violation: {log.violation_type}",
                "description": f"Detected {log.violation_type} with {log.confidence*100:.1f}% confidence",
                "timestamp": log.timestamp,
                "location": log.camera.location if log.camera else "Unknown Location", 
                "cameraId": log.camera.camera_id if log.camera else "Unknown Camera", 
                "clipUrl": log.snapshot_path.url if bool(log.snapshot_path) else "" 
            })
             
        return Response({"events": events})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)
