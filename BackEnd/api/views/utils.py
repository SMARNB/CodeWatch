"""CodeWatch API views — utils domain (split from the monolithic api/views.py)."""
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




# Rewrite absolute media URLs (e.g. http://127.0.0.1:8000/media/x.jpg) to relative /media/x.jpg so
# images load from whatever origin the client used. New responses are already relative; this also
# repairs legacy report data saved with absolute URLs. Accepts a single URL or a whole JSON string
# (rewrites every occurrence); returns non-strings unchanged.
_MEDIA_ABS_RE = re.compile(r'https?://[^/\s"]+(/media/)')

def _rel_media(value):
    if not isinstance(value, str) or not value:
        return value
    return _MEDIA_ABS_RE.sub(r'\1', value)


class IsAdminRole(BasePermission):
    """Authenticated AND an admin-level login role. Guards user-management / privileged
    mutations so a logged-in guard can't, e.g., reset an admin's password."""
    ADMIN_ROLES = {'admin'}

    def has_permission(self, request, view):
        u = getattr(request, 'user', None)
        if not (u and u.is_authenticated):
            return False
        if u.is_superuser:
            return True
        profile = getattr(u, 'userprofile', None)
        return bool(profile and profile.role in self.ADMIN_ROLES)


class IsAdminOrSsdRole(IsAdminRole):
    """Authenticated AND an admin- or ssd-level login role. Guards the dress-code policy
    editor — the people who set institutional dress-code standards."""
    ADMIN_ROLES = {'admin', 'ssd'}
# ------------------------------------------------------------------------

try:
    face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
except Exception as e:
    print(f"Failed to initialize FaceAnalysis: {e}")
    face_app = None

def cosine_similarity(target_emb, db_matrix):
    target = np.array(target_emb, dtype=np.float32).flatten()
    norm_db = np.linalg.norm(db_matrix, axis=1, keepdims=True)
    norm_target = np.linalg.norm(target)
    if norm_target == 0: return np.zeros(db_matrix.shape[0])
    sims = np.dot(db_matrix, target) / (norm_db.flatten() * norm_target)
    return sims

# --- 4. Database ---

# ---------------------------------------------------------------------------
# Department-Head scoping helpers
# A department-head sees only their own department's people PLUS every unknown
# (auto-registered intruder). Admin / SSD / Guard get full, unfiltered access.
# ---------------------------------------------------------------------------
def _requester_scope(request):
    """
    Returns (role, department):
      role       - the requester's login role, or None if we can't resolve them.
      department - the department a department-head is limited to, or None for
                   full access (admin / ssd / guard, or unresolved).
    Identity comes from the AUTHENTICATED request (API token) — never from client-supplied
    ?user/?role params, which can't be trusted.
    """
    user = getattr(request, 'user', None)
    if not (user and user.is_authenticated):
        return (None, None)

    try:
        profile = user.userprofile
        role = profile.role
    except Exception:
        return (None, None)

    if role != 'department-head':
        return (role, None)

    department = getattr(profile, 'department', None)
    if not department and user.email:
        person = TrackedPerson.objects.filter(email__iexact=user.email).first()
        if person:
            department = person.department
    return (role, department)


def _auth_user_key_and_role(request):
    """(user_key, role) for the AUTHENTICATED requester — for per-user notification state and
    role-targeted visibility. Never trusts client-supplied ?user/?role."""
    u = getattr(request, 'user', None)
    if not (u and u.is_authenticated):
        return ('', '')
    role, _ = _requester_scope(request)
    return ((u.email or u.username or '').strip(), (role or '').lower())


def _person_scope_q(department, prefix=''):
    """
    Q() limiting results to a department-head's department OR any unknown person.
    `prefix` reaches a related TrackedPerson, e.g. 'person__' on ViolationLog.
    If department is falsy, this matches unknowns only (fail-safe).
    """
    from django.db.models import Q
    class_field = f"{prefix}classification__icontains"
    q = Q(**{class_field: 'unknown'})
    if department:
        dept_field = f"{prefix}department__iexact"
        q = Q(**{dept_field: department}) | q
    return q

# ============ Identity de-duplication ============
def _person_embeddings(p):
    """All 512-d vectors for a person, from either embedding field, handling single-vector or list shapes."""
    import json
    vecs = []
    for raw in (p.embedding_data, p.face_embedding):
        if not raw or raw == "[]":
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        if not data:
            continue
        if isinstance(data[0], (int, float)):   # a single [512] vector
            vecs.append(data)
        else:                                    # a list of vectors
            vecs.extend(data)
    return vecs
