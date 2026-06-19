"""CodeWatch API views — dress_code domain (split from the monolithic api/views.py)."""
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


# =================================================


# ===================== Dress-code policy =========================================
# Admin-editable replacement for the formerly-hardcoded clothing rules in FinalSystem.py.
# Reading the policy is open to any authenticated user (FinalSystem's service account loads it,
# same as it reads cameras/blacklist); editing is restricted to admin/ssd.

@api_view(['GET'])
def dress_code_rules(request):
    """List every dress-code rule (one per clothing class). Used by the admin editor UI and by
    FinalSystem.py to build its violation/compliant sets at startup and on each refresh."""
    rules = DressCodeRule.objects.all()
    return Response(DressCodeRuleSerializer(rules, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAdminOrSsdRole])
def update_dress_code_rule(request, pk):
    """Update a single rule's `status` and/or `gender`. Admin/ssd only."""
    try:
        rule = DressCodeRule.objects.get(pk=pk)
    except DressCodeRule.DoesNotExist:
        return Response({"status": "error", "message": "Rule not found"}, status=404)

    valid_status = {c[0] for c in DressCodeRule.STATUS_CHOICES}
    valid_gender = {c[0] for c in DressCodeRule.GENDER_CHOICES}

    new_status = request.data.get('status')
    new_gender = request.data.get('gender')
    if new_status is not None:
        if new_status not in valid_status:
            return Response({"status": "error", "message": f"Invalid status '{new_status}'"}, status=400)
        rule.status = new_status
    if new_gender is not None:
        if new_gender not in valid_gender:
            return Response({"status": "error", "message": f"Invalid gender '{new_gender}'"}, status=400)
        rule.gender = new_gender
    rule.save()
    return Response(DressCodeRuleSerializer(rule).data)
