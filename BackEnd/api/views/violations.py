"""CodeWatch API views — violations domain (split from the monolithic api/views.py)."""
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



DRESS_CODE_KEYWORDS = (
    'dress', 'shirt', 'uniform', 'attire', 'cloth', 'tie',
    'jacket', 'coat', 'vest', 'outfit', 'apparel', 'sleeve',
    'shorts', 'pant', 'trouser', 'shoe', 'sandal', 'cap', 'hat',
)

def normalize_violation_category(v_type):
    """ Collapses every dress-code-style label into one 'dress_code' category.
        Any other violation type keeps its own identity. """
    t = (v_type or '').strip().lower()
    if any(k in t for k in DRESS_CODE_KEYWORDS):
        return 'dress_code'
    return t


@api_view(['POST'])
def log_violation(request):
    """ Receives alerts from the AI script. One violation per person, per CATEGORY, per day.
        All dress-code labels collapse into a single category. """
    person_id = request.data.get('person_id')
    if person_id is None:
        return Response({"status": "skipped", "message": "Violation skipped, person_id is None"})

    v_type = request.data.get('type')
    conf = request.data.get('conf', 0.0)
    snapshot = request.data.get('snapshot')
    camera_id = request.data.get('camera_id')

    try:
        p = None
        if person_id:
            try:
                p = TrackedPerson.objects.get(id=person_id)
            except TrackedPerson.DoesNotExist:
                pass

        camera = None
        if camera_id:
            try:
                camera = Camera.objects.get(camera_id=camera_id)
            except Camera.DoesNotExist:
                pass

        # --- DEDUP: one violation per person, per category, per day ---
        # (every dress-code label collapses into a single 'dress_code' category)
        if p is not None:
            today = timezone.localdate()
            new_category = normalize_violation_category(v_type)
            todays_types = ViolationLog.objects.filter(
                person=p, timestamp__date=today
            ).values_list('violation_type', flat=True)
            existing_categories = {normalize_violation_category(t) for t in todays_types}
            if new_category in existing_categories:
                return Response({"status": "skipped", "message": "Already logged this category for this person today."})
        # --------------------------------------------------------------

        # 1. Create Log
        violation_log = ViolationLog.objects.create(person=p, camera=camera, violation_type=v_type, confidence=conf)

        # 2. Save Snapshot
        if snapshot:
            try:
                format, imgstr = snapshot.split(';base64,') if ';base64,' in snapshot else ('', snapshot)
                ext = format.split('/')[-1] if format else 'jpg'
                filename = f"viol_{violation_log.id}.{ext}"
                data = ContentFile(base64.b64decode(imgstr), name=filename)
                violation_log.snapshot_path = data
                violation_log.save()
            except Exception as snap_e:
                print(f"Error saving snapshot: {snap_e}")

        # 3. Link to Notification System
        v_label = v_type or "Security Alert"
        title = f"{v_label} on {camera.name}" if camera else f"Alert: {v_label}"
        who = p.name if p is not None else "An unidentified person"
        message = f"{who} — {v_label} at {camera.location if camera else 'Unknown'}. Camera: {camera.camera_id if camera else 'Unknown'}"

        notif_type = 'security'
        if v_type and 'Dress' in v_type: notif_type = 'system'

        Notification.objects.create(
            title=title,
            message=message,
            notif_type=notif_type,
            person=p,
            camera=camera,
            violation_log=violation_log
        )

        # 4. Email the person about their violation (only if they have a real contact email)
        try:
            if p is not None and getattr(p, 'contact_email', None):
                from django.core.mail import send_mail
                from django.conf import settings as dj_settings
                loc = camera.location if camera else 'an unknown location'
                cam_name = camera.name if camera else 'a camera'
                when = timezone.localtime(violation_log.timestamp).strftime('%d %b %Y, %I:%M %p')
                send_mail(
                    f"Code Watch: {v_type} (Violation #{violation_log.id})",
                    (
                        f"Hello {p.name},\n\n"
                        f"A violation was recorded for you by Code Watch.\n\n"
                        f"Violation ID: {violation_log.id}\n"
                        f"Type: {v_type}\n"
                        f"Location: {loc} ({cam_name})\n"
                        f"Time: {when}\n\n"
                        f"If you believe this is a mistake, please contact the administration.\n\n"
                        f"— Code Watch"
                    ),
                    getattr(dj_settings, 'DEFAULT_FROM_EMAIL', None) or getattr(dj_settings, 'EMAIL_HOST_USER', None),
                    [p.contact_email],
                    fail_silently=True,
                )
        except Exception as mail_e:
            print(f"Violation email failed: {mail_e}")
    except Exception as e:
        print(f"Error logging violation: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)

    return Response({"status": "logged"})


@api_view(['GET', 'DELETE'])
def manage_violations(request, pk=None):
    if request.method == 'GET':
        violations = ViolationLog.objects.select_related('person', 'camera').prefetch_related('notification_set').all()

        # Department-Head scoping: only their department + any unknown.
        role, dept = _requester_scope(request)
        if role == 'department-head':
            violations = violations.filter(_person_scope_q(dept, 'person__'))
        
        # Filtering
        v_type = request.GET.get('type')
        if v_type and v_type.lower() != 'all':
            violations = violations.filter(violation_type__icontains=v_type)
            
        camera_id = request.GET.get('camera_id')
        if camera_id and camera_id.lower() != 'all':
            violations = violations.filter(Q(camera__camera_id=camera_id) | Q(camera__name=camera_id))
            
        date_from = request.GET.get('date_from')
        if date_from:
            violations = violations.filter(timestamp__gte=date_from)
            
        date_to = request.GET.get('date_to')
        if date_to:
            violations = violations.filter(timestamp__lte=date_to)
            
        violations = violations.order_by('-timestamp')
        
        # Pagination
        try:
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', 50))
        except ValueError:
            page = 1
            page_size = 50
            
        paginator = Paginator(violations, page_size)
        page_obj = paginator.get_page(page)
        
        results = []
        for v in page_obj:
            person_name = v.person.name if v.person else "Unknown"
            person_id = v.person.id if v.person else None
            camera_name = v.camera.name if v.camera else "Unknown Camera"
            snapshot_url = v.snapshot_path.url if v.snapshot_path else None
            
            # Find related notification id if it exists
            notifications = v.notification_set.all()
            notification_id = notifications[0].id if notifications else None
            
            results.append({
                "id": v.id,
                "violation_type": v.violation_type,
                "person_name": person_name,
                "person_id": person_id,
                "confidence": v.confidence,
                "timestamp": v.timestamp.strftime("%b %d, %Y, %I:%M %p"),
                "camera_name": camera_name,
                "snapshot_url": snapshot_url,
                "notification_id": notification_id
            })
            
        return Response({
            "results": results,
            "total": paginator.count,
            "page": page_obj.number,
            "pages": paginator.num_pages
        })
    
    if request.method == 'DELETE':
        try:
            ViolationLog.objects.get(id=pk).delete()
            return Response(status=204)
        except ViolationLog.DoesNotExist:
            return Response({"error": "Violation not found"}, status=404)
