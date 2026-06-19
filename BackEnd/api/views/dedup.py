"""CodeWatch API views — dedup domain (split from the monolithic api/views.py)."""
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




def _choose_primary(people):
    """Prefer a named (non-unknown) person, then the one with the most history, then the oldest."""
    def rank(p):
        is_named = 0 if p.classification == 'unknown' else 1
        history = p.violationlog_set.count() + p.movements.count()
        return (is_named, history, -p.id)
    return max(people, key=rank)


def _merge_persons(primary, dups):
    """Reassign all related rows from dups to primary, fold in their embeddings, delete dups."""
    import json
    if not dups:
        return 0
    dup_ids = [d.id for d in dups]
    reassigned = 0
    reassigned += ViolationLog.objects.filter(person_id__in=dup_ids).update(person=primary)
    reassigned += MovementLog.objects.filter(person_id__in=dup_ids).update(person=primary)
    IncidentReport.objects.filter(related_person_id__in=dup_ids).update(related_person=primary)
    Notification.objects.filter(person_id__in=dup_ids).update(person=primary)
    VisitorLog.objects.filter(person_id__in=dup_ids).update(person=primary)
    Blacklist.objects.filter(person_id__in=dup_ids).update(person=primary)

    # Fold the duplicates' embeddings into the primary so it's recognised from more angles.
    vecs = _person_embeddings(primary)
    for d in dups:
        vecs.extend(_person_embeddings(d))
    uniq, seen = [], set()
    for v in vecs:
        sig = tuple(round(x, 4) for x in v[:8])
        if sig not in seen:
            seen.add(sig)
            uniq.append(v)
    primary.embedding_data = json.dumps(uniq[:20])   # cap to avoid bloat
    primary.save(update_fields=['embedding_data'])

    TrackedPerson.objects.filter(id__in=dup_ids).delete()
    return reassigned


def run_identity_dedup(threshold=0.55):
    """Cluster TrackedPersons by face similarity and merge duplicates into one primary each."""
    import numpy as np
    people = list(TrackedPerson.objects.all())
    rows, owner = [], []
    for i, p in enumerate(people):
        for v in _person_embeddings(p):
            if v:
                rows.append(v); owner.append(i)
    if len(rows) < 2:
        return {"clusters_merged": 0, "clusters_skipped": 0, "people_removed": 0, "logs_reassigned": 0}

    mat = np.array(rows, dtype=np.float32)
    norms = np.linalg.norm(mat, axis=1, keepdims=True); norms[norms == 0] = 1e-9
    matn = mat / norms
    sims = matn @ matn.T

    parent = list(range(len(people)))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb: parent[ra] = rb

    n = len(rows)
    for a in range(n):
        for b in range(a + 1, n):
            if owner[a] != owner[b] and sims[a, b] >= threshold:
                union(owner[a], owner[b])

    clusters = {}
    for i in range(len(people)):
        clusters.setdefault(find(i), []).append(i)

    merged = skipped = removed = reassigned = 0
    for members in clusters.values():
        if len(members) < 2:
            continue
        member_people = [people[i] for i in members]
        named = [p for p in member_people if p.classification != 'unknown']
        if len(named) >= 2:
            skipped += 1            # two real identities clustered — leave for manual review
            continue
        primary = _choose_primary(member_people)
        dups = [p for p in member_people if p.id != primary.id]
        reassigned += _merge_persons(primary, dups)
        merged += 1
        removed += len(dups)
    return {"clusters_merged": merged, "clusters_skipped": skipped, "people_removed": removed, "logs_reassigned": reassigned}


@api_view(['POST'])
@permission_classes([IsAdminRole])
def dedup_identities(request):
    """ Admin-only: cross-match embeddings and merge duplicate identities. """
    threshold = float(request.data.get('threshold', 0.55))
    summary = run_identity_dedup(threshold=threshold)
    return Response({"status": "success", **summary})
