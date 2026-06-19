"""CodeWatch API views — feedback domain (split from the monolithic api/views.py)."""
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



@api_view(['POST'])
def submit_feedback(request):
    from ..models import Feedback, ViolationLog
    data = request.data

    # Confirm the typed Violation ID actually exists before saving
    violation_id = data.get('violation_id')
    vlog = None
    if violation_id not in (None, ''):
        try:
            vlog = ViolationLog.objects.get(id=int(violation_id))
        except (ViolationLog.DoesNotExist, ValueError, TypeError):
            return Response({"status": "error", "message": f"No violation found with ID {violation_id}."}, status=404)

    feedback = Feedback.objects.create(
        user_type=data.get('userType'),
        user_id=data.get('userId'),
        thoughts=data.get('thoughts'),
        is_request_sent=data.get('sendRequest', False)
    )
    if vlog:
        feedback.violation_log = vlog
        feedback.save()

    return Response({"status": "success"})


@api_view(['POST'])
def submit_feedback_report(request):
    """ Posts violation feedback as an Incident Report (shows up in Reports),
        attaching the violator's most recent snapshot so they're caught in the act. """
    data = request.data
    person_id = data.get('person_id')
    violation_id = data.get('violation_id')
    thoughts = (data.get('thoughts') or '').strip()

    if not thoughts:
        return Response({"status": "error", "message": "No feedback text provided."}, status=400)

    person = None
    if person_id:
        try:
            person = TrackedPerson.objects.get(id=person_id)
        except TrackedPerson.DoesNotExist:
            person = None

    # Most recent snapshot for this violator
    snap_log = None
    if person:
        snap_log = (ViolationLog.objects
                    .filter(person=person)
                    .exclude(snapshot_path='')
                    .order_by('-timestamp')
                    .first())
    if snap_log is None and violation_id:
        try:
            snap_log = ViolationLog.objects.get(id=violation_id)
        except ViolationLog.DoesNotExist:
            snap_log = None

    snapshot_url = None
    if snap_log and snap_log.snapshot_path:
        try:
            snapshot_url = snap_log.snapshot_path.url
        except Exception:
            snapshot_url = None

    person_name = person.name if person else "Unknown Person"
    analytics = {
        "snapshots": [snapshot_url] if snapshot_url else [],
        "violator_details": {
            "name": person_name,
            "employee_id": person.employee_id if person else None,
            "classification": person.classification if person else None,
        }
    }

    report = IncidentReport.objects.create(
        report_type="Violation Feedback",
        recipients=data.get('userId') or "",
        subject=f"Violation Feedback: {person_name}",
        priority="Normal",
        message=thoughts,
        related_person_id=person.id if person else None,
        analytics_json=json.dumps(analytics)
    )

    return Response({"status": "success", "report_id": report.id})
