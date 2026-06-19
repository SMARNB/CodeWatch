"""CodeWatch API views — blacklist domain (split from the monolithic api/views.py)."""
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




@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
def manage_blacklist(request, pk=None):
    if request.method == 'GET':
        entries = Blacklist.objects.filter(is_active=True).order_by('-created_at')
        role, dept = _requester_scope(request)
        if role == 'department-head':
            entries = entries.filter(_person_scope_q(dept, 'person__'))
        data = []
        for e in entries:
            data.append({
                "id": e.id,
                "person_name": e.person.name,
                "person_id": e.person.id,
                "reason": e.reason,
                "blacklist_type": e.blacklist_type,
                "violation_threshold": e.violation_threshold,
                "created_at": e.created_at
            })
        return Response(data)
    
    elif request.method == 'POST':
        person_id = request.data.get('person_id')
        reason = request.data.get('reason')
        threshold = request.data.get('violation_threshold', 10)
        try:
            person = TrackedPerson.objects.get(id=person_id)
            entry = Blacklist.objects.create(
                person=person,
                reason=reason,
                blacklist_type='manual',
                violation_threshold=threshold,
                added_by=request.user if request.user.is_authenticated else None
            )
            person.classification = 'blacklisted'
            person.save()
            return Response({
                "id": entry.id,
                "person_id": person.id,
                "reason": entry.reason,
                "status": "success"
            }, status=201)
        except TrackedPerson.DoesNotExist:
            return Response({"error": "Person not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=400)
    elif request.method == 'PATCH':
        try:
            entry = Blacklist.objects.get(id=pk)
            if 'reason' in request.data:
                entry.reason = request.data['reason']
            if 'is_active' in request.data:
                entry.is_active = request.data['is_active']
                if not entry.is_active:
                    entry.person.classification = 'unknown'
                    entry.person.save()
            entry.save()
            return Response({"status": "success"})
        except Blacklist.DoesNotExist:
            return Response({"message": "Not found"}, status=404)
            
    elif request.method == 'DELETE':
        try:
            entry = Blacklist.objects.get(id=pk)
            entry.person.classification = 'unknown'
            entry.person.save()
            entry.delete()
            return Response(status=204)
        except Blacklist.DoesNotExist:
            return Response({"error": "Not found"}, status=404)


@api_view(['POST'])
def toggle_blacklist(request):
    """ Blacklist or un-blacklist a person by person_id, reusing any existing
        entry so it never errors on a duplicate. """
    person_id = request.data.get('person_id')
    try:
        person = TrackedPerson.objects.get(id=person_id)
    except TrackedPerson.DoesNotExist:
        return Response({"status": "error", "message": "Person not found"}, status=404)

    currently = Blacklist.objects.filter(person=person, is_active=True).exists() or person.classification == 'blacklisted'

    if currently:
        Blacklist.objects.filter(person=person, is_active=True).update(is_active=False)
        eid = (person.employee_id or '').upper()
        person.classification = 'unknown' if eid.startswith(('UNK-', 'VIS-')) else 'known'
        person.save()
        return Response({"status": "success", "blacklisted": False, "message": f"{person.name} removed from blacklist."})

    entry = Blacklist.objects.filter(person=person).first()
    if entry:
        entry.is_active = True
        entry.reason = request.data.get('reason', 'Manually blacklisted from Admin Panel')
        entry.blacklist_type = 'manual'
        entry.save()
    else:
        Blacklist.objects.create(
            person=person,
            reason=request.data.get('reason', 'Manually blacklisted from Admin Panel'),
            blacklist_type='manual',
            violation_threshold=request.data.get('violation_threshold', 0),
            added_by=request.user if request.user.is_authenticated else None
        )
    person.classification = 'blacklisted'
    person.save()
    return Response({"status": "success", "blacklisted": True, "message": f"{person.name} added to blacklist."})
