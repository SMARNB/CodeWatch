"""CodeWatch API views — visitors domain (split from the monolithic api/views.py)."""
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



# --- GUARD PORTAL ENDPOINTS ---

@api_view(['POST'])
def add_visitor(request):
    """ Guard visitor check-in. A face photo is required so the visitor is trackable.
        If the face is already an auto-registered 'John Doe', that record is promoted
        to a visitor instead of creating a duplicate. """
    try:
        data = request.data
        name = data.get('name')
        phone = data.get('phone')
        purpose = data.get('purpose')
        host_name = data.get('host_name')
        host_department = data.get('host_department')
        expected_duration_hours = int(data.get('expected_duration_hours', 2))
        contact_email = (data.get('contact_email') or '').strip() or None

        timestamp_str = timezone.now().strftime("%Y%m%d%H%M%S")
        unique_id = f"VIS-{timestamp_str}"
        email = f"{unique_id}@codewatch.com"

        # --- A face photo is required so the camera can actually recognise the visitor ---
        pic = request.FILES.get('profile_picture')
        if pic is None:
            return Response({"status": "error", "message": "A face photo is required to register a visitor."}, status=400)
        if face_app is None:
            return Response({"status": "error", "message": "Face engine not available on the server."}, status=500)
        try:
            file_bytes = np.frombuffer(pic.read(), np.uint8)
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            pic.seek(0)
        except Exception:
            img = None
        faces = face_app.get(img) if img is not None else None
        if not faces:
            return Response({"status": "error", "message": "No face detected; please use a clear, front-facing photo."}, status=400)
        faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
        embedding = faces[0].embedding.tolist()

        # --- Promote a matching 'John Doe' instead of creating a duplicate ---
        promoted, best_score = None, 0.0
        target = np.array(embedding, dtype=np.float32).flatten()
        tnorm = np.linalg.norm(target)
        if tnorm > 0:
            for cand in TrackedPerson.objects.filter(classification='unknown'):
                if not cand.embedding_data or cand.embedding_data in ('', '[]'):
                    continue
                try:
                    raw = json.loads(cand.embedding_data)
                except Exception:
                    continue
                vecs = [raw] if (raw and isinstance(raw[0], (int, float))) else raw
                for v in vecs:
                    arr = np.array(v, dtype=np.float32).flatten()
                    if arr.shape[0] != 512:
                        continue
                    denom = np.linalg.norm(arr) * tnorm
                    if denom == 0:
                        continue
                    score = float(np.dot(arr, target) / denom)
                    if score > best_score:
                        promoted, best_score = cand, score
            if best_score < 0.5:
                promoted = None

        if promoted is not None:
            new_person = promoted
            new_person.name = name
            new_person.employee_id = unique_id
            new_person.email = email
            new_person.role = 'visitor'
            new_person.classification = 'visitor'
            new_person.phone = phone
            new_person.contact_email = contact_email or new_person.contact_email
            try:
                existing = json.loads(new_person.embedding_data) if new_person.embedding_data not in ('', '[]', None) else []
                if existing and isinstance(existing[0], (int, float)):
                    existing = [existing]
                elif not isinstance(existing, list):
                    existing = []
            except Exception:
                existing = []
            existing.append(embedding)
            new_person.embedding_data = json.dumps(existing)
            new_person.profile_picture = pic
            new_person.save()
            print(f"🔼 Promoted unknown #{new_person.id} -> visitor {name} (match {best_score:.2f})")
        else:
            new_person = TrackedPerson.objects.create(
                name=name,
                employee_id=unique_id,
                email=email,
                role='visitor',
                classification='visitor',
                phone=phone,
                contact_email=contact_email,
                embedding_data=json.dumps(embedding),
            )
            new_person.profile_picture = pic
            new_person.save()

        visitor_log = VisitorLog.objects.create(
            person=new_person,
            purpose=purpose,
            host_name=host_name,
            host_department=host_department,
            expected_duration_hours=expected_duration_hours
        )

        try:
            redis_client = redis.Redis(host='localhost', port=6379, db=1)
            redis_key = f"visitor:{new_person.id}"
            redis_client.setex(redis_key, expected_duration_hours * 3600, "active")
        except Exception as e:
            print(f"Redis error: {e}")

        return Response({"status": "success", "visitor_log_id": visitor_log.id, "person_id": new_person.id})
    except Exception as e:
        print(f"Error adding visitor: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['GET'])
def get_active_visitors(request):
    try:
        active_logs = VisitorLog.objects.filter(is_active=True).select_related('person')
        data = []
        now = timezone.now()
        for log in active_logs:
            expected_end_time = log.check_in + timezone.timedelta(hours=log.expected_duration_hours)
            time_remaining_sec = (expected_end_time - now).total_seconds()
            
            time_remaining_str = ""
            is_overdue = False
            
            if time_remaining_sec < 0:
                is_overdue = True
                overdue_sec = abs(time_remaining_sec)
                hours, remainder = divmod(overdue_sec, 3600)
                minutes, _ = divmod(remainder, 60)
                time_remaining_str = f"Overdue by {int(hours)}h {int(minutes)}m"
            else:
                hours, remainder = divmod(time_remaining_sec, 3600)
                minutes, _ = divmod(remainder, 60)
                time_remaining_str = f"{int(hours)}h {int(minutes)}m remaining"
                
            data.append({
                "id": log.id,
                "person_id": log.person.id,
                "name": log.person.name,
                "phone": log.person.phone,
                "purpose": log.purpose,
                "host_name": log.host_name,
                "host_department": log.host_department,
                "check_in": log.check_in,
                "expected_duration": log.expected_duration_hours,
                "time_remaining": time_remaining_str,
                "time_remaining_sec": time_remaining_sec,
                "is_overdue": is_overdue
            })
        return Response(data)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['GET'])
def get_all_visitors(request):
    try:
        logs = VisitorLog.objects.all().select_related('person').order_by('-check_in')
        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "person_id": log.person.id,
                "name": log.person.name,
                "phone": log.person.phone,
                "purpose": log.purpose,
                "host_name": log.host_name,
                "check_in": log.check_in,
                "check_out": log.check_out,
                "duration": log.expected_duration_hours,
                "is_active": log.is_active
            })
        return Response(data)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['POST'])
def checkout_visitor(request, visitor_log_id):
    try:
        log = VisitorLog.objects.get(id=visitor_log_id)
        if not log.is_active:
            return Response({"status": "error", "message": "Visitor already checked out"}, status=400)
            
        log.check_out = timezone.now()
        log.is_active = False
        if request.user.is_authenticated:
            log.checked_out_by = request.user
        log.save()
        
        person = log.person
        person.classification = 'expired_visitor'
        person.save()
        
        try:
            redis_client = redis.Redis(host='localhost', port=6379, db=1)
            redis_client.delete(f"visitor:{person.id}")
        except Exception as e:
            pass
            
        return Response({"status": "success", "message": "Visitor checked out successfully"})
    except VisitorLog.DoesNotExist:
        return Response({"status": "error", "message": "Visitor log not found"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['PATCH'])
def extend_visitor(request, visitor_log_id):
    try:
        log = VisitorLog.objects.get(id=visitor_log_id)
        additional_hours = int(request.data.get('additional_hours', 1))
        
        log.expected_duration_hours += additional_hours
        log.save()
        
        try:
            now = timezone.now()
            expected_end_time = log.check_in + timezone.timedelta(hours=log.expected_duration_hours)
            time_remaining_sec = (expected_end_time - now).total_seconds()
            
            if time_remaining_sec > 0:
                redis_client = redis.Redis(host='localhost', port=6379, db=1)
                redis_key = f"visitor:{log.person.id}"
                redis_client.setex(redis_key, int(time_remaining_sec), "active")
        except Exception as e:
            pass
            
        return Response({"status": "success", "message": f"Extended by {additional_hours} hour(s)"})
    except VisitorLog.DoesNotExist:
        return Response({"status": "error", "message": "Visitor log not found"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)
