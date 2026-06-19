"""CodeWatch API views — search domain (split from the monolithic api/views.py)."""
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
def search_all(request):
    query = request.GET.get('q', '')
    if not query:
        return Response({"people": [], "cameras": [], "violations": []})

    role, dept = _requester_scope(request)

    people = TrackedPerson.objects.filter(
        Q(name__icontains=query) |
        Q(employee_id__icontains=query) |
        Q(email__icontains=query)
    )
    violations = ViolationLog.objects.filter(
        Q(violation_type__icontains=query)
    )
    if role == 'department-head':
        people = people.filter(_person_scope_q(dept))
        violations = violations.filter(_person_scope_q(dept, 'person__'))

    cameras = Camera.objects.filter(
        Q(name__icontains=query) |
        Q(camera_id__icontains=query) |
        Q(location__icontains=query)
    )

    redis_client = redis.Redis(host='localhost', port=6379, db=1)

    people_data = []
    for p in people:
        violation_count = ViolationLog.objects.filter(person=p).count()
        is_live = False
        current_camera = None
        redis_data = redis_client.get(f"global_identity:{p.id}")
        if redis_data:
            data = json.loads(redis_data)
            is_live = True
            current_camera = data.get("camera_name", "Unknown")
        people_data.append({
            "id": p.id,
            "name": p.name,
            "employee_id": p.employee_id,
            "department": p.department,
            "role": p.role,
            "classification": p.classification,
            "violation_count": violation_count,
            "is_live": is_live,
            "current_camera": current_camera
        })

    cameras_data = [{"id": c.id, "name": c.name, "camera_id": c.camera_id, "location": c.location} for c in cameras]
    violations_data = [{"id": v.id, "type": v.violation_type, "timestamp": v.timestamp, "person": v.person.name if v.person else "Unknown"} for v in violations]

    return Response({
        "people": people_data,
        "cameras": cameras_data,
        "violations": violations_data
    })
