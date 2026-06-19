"""CodeWatch API views — people domain (split from the monolithic api/views.py)."""
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
def add_member(request):
    """
    Saves a new member from the React Modal.
    - Classification is derived automatically from the user type + login role.
    - If the face already exists as an auto-registered "John Doe" (unknown), that record
      is promoted in place instead of creating a duplicate.
    """
    try:
        data = request.data
        role = (data.get('role') or '').strip().lower()        # student / employee / visitor
        login_role = data.get('login_role')                    # admin / ssd / department-head / guard
        email = data.get('email')
        employee_id = data.get('employee_id')
        name = data.get('name')
        gender = (data.get('gender') or 'male').strip().lower()
        if gender not in ('male', 'female'):
            gender = 'male'
        contact_email = (data.get('contact_email') or '').strip() or None

        SYSTEM_ROLES = ['admin', 'ssd', 'department-head', 'guard']
        create_account = str(data.get('has_software_access', 'false')).lower() == 'true' and (login_role in SYSTEM_ROLES)

        # Block early if the login email is taken (so we don't create/promote then fail).
        if create_account and email and User.objects.filter(email=email).exists():
            return Response({"status": "error", "message": "A user with this email already exists."}, status=400)

        # --- Classification, derived from what was entered (no manual picker) ---
        if role == 'visitor':
            classification = 'visitor'
        elif role == 'student':
            classification = 'student'
        elif create_account and login_role == 'admin':
            classification = 'employee_admin'
        elif create_account and login_role == 'ssd':
            classification = 'employee_ssd'
        elif create_account and login_role == 'department-head':
            classification = 'employee_dept_head'
        elif create_account and login_role == 'guard':
            classification = 'employee_guard'
        else:
            classification = 'employee'

        # --- Pull the face embedding from the uploaded photo up front ---
        embedding = None
        pic = request.FILES.get('profile_picture')
        if pic is not None:
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
                return Response({"status": "error", "message": "Face detection failed; please provide a clearer image."}, status=400)
            faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
            embedding = faces[0].embedding.tolist()

        # --- If this face is already an auto-registered "John Doe", promote it instead of duplicating ---
        promoted, best_score = None, 0.0
        if embedding is not None:
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

        # --- Create, or promote the existing unknown record ---
        if promoted is not None:
            person = promoted
            person.name = name
            person.employee_id = employee_id
            person.email = email
            person.role = role or person.role
            person.department = data.get('department') or person.department
            person.phone = data.get('phone')
            person.gender = gender
            person.classification = classification
            person.contact_email = contact_email or person.contact_email
            try:
                existing = json.loads(person.embedding_data) if person.embedding_data not in ('', '[]', None) else []
                if existing and isinstance(existing[0], (int, float)):
                    existing = [existing]
                elif not isinstance(existing, list):
                    existing = []
            except Exception:
                existing = []
            existing.append(embedding)
            person.embedding_data = json.dumps(existing)
            if pic is not None:
                person.profile_picture = pic
            person.save()
            print(f"🔼 Promoted unknown #{person.id} -> {name} [{classification}] (match {best_score:.2f})")
        else:
            person = TrackedPerson.objects.create(
                name=name,
                employee_id=employee_id,
                email=email,
                role=role or None,
                department=data.get('department'),
                phone=data.get('phone'),
                gender=gender,
                classification=classification,
                contact_email=contact_email,
                embedding_data=json.dumps(embedding) if embedding is not None else "[]",
            )
            if pic is not None:
                person.profile_picture = pic
                person.save()

        # --- System login account (same behaviour as before) ---
        if create_account:
            username = name or email
            if User.objects.filter(username=username).exists():
                username = f"{name} ({employee_id})"
            user = User.objects.create_user(
                username=username,
                email=email,
                password=data.get('password') or 'password123'
            )
            profile = UserProfile.objects.create(
                user=user,
                role=login_role,
                must_change_password=True,
                department=data.get('department'),
            )
            if embedding is not None:
                profile.face_embedding = json.dumps(embedding)
                profile.save()
            print(f"✅ System User Created: {username} ({classification})")

        return Response({"status": "success", "id": person.id})
    except Exception as e:
        print(f"Error adding member: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['POST'])
def add_person_photos(request, person_id):
    """ Adds one or more face photos to a person: an embedding per photo (better
        recognition), and refreshes the profile picture from the first valid photo. """
    try:
        person = TrackedPerson.objects.get(id=person_id)
    except TrackedPerson.DoesNotExist:
        return Response({"status": "error", "message": "Person not found"}, status=404)

    files = request.FILES.getlist('photos')
    if not files:
        return Response({"status": "error", "message": "No photos provided."}, status=400)
    if face_app is None:
        return Response({"status": "error", "message": "Face engine not available on the server."}, status=500)

    # Existing embeddings -> list
    existing = []
    if person.embedding_data and person.embedding_data not in ('', '[]'):
        try:
            raw = json.loads(person.embedding_data)
            if raw and isinstance(raw[0], (int, float)):
                existing = [raw]
            elif raw:
                existing = [v for v in raw if isinstance(v, list)]
        except Exception:
            existing = []

    added, failed, first_saved = 0, 0, False
    for f in files:
        try:
            file_bytes = np.frombuffer(f.read(), np.uint8)
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if img is None:
                failed += 1
                continue
            faces = face_app.get(img)
            if not faces:
                failed += 1
                continue
            faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
            existing.append(faces[0].embedding.tolist())
            added += 1
            if not first_saved:
                f.seek(0)
                person.profile_picture.save(f"person_{person.id}_{int(time.time())}.jpg", ContentFile(f.read()), save=False)
                first_saved = True
        except Exception as e:
            print(f"add_person_photos error: {e}")
            failed += 1

    if added == 0:
        return Response({"status": "error", "message": "No face detected in the photo(s). Use clear, front-facing images."}, status=400)

    person.embedding_data = json.dumps(existing)
    person.save()
    return Response({"status": "success", "added": added, "failed": failed, "total_embeddings": len(existing)})

# --- 1. AI SYSTEM ENDPOINTS ---

@api_view(['GET'])
def get_all_embeddings(request):
    """ Sends known faces with ALL their embeddings to the AI script.
        Returns 'embeddings' (list) plus 'embedding' (first one, backward-compat). """
    persons = TrackedPerson.objects.all()
    data = {}
    for p in persons:
        try:
            if not p.embedding_data or p.embedding_data in ('', '[]'):
                continue
            raw = json.loads(p.embedding_data)
            if not raw:
                continue
            # Normalize: support legacy single-vector AND new list-of-vectors
            if isinstance(raw[0], (int, float)):
                embeddings = [raw]
            else:
                embeddings = [v for v in raw if isinstance(v, list)]
            if not embeddings:
                continue
            data[p.id] = {
                "name": p.name,
                "embedding": embeddings[0],
                "embeddings": embeddings,
                "classification": getattr(p, 'classification', 'unknown')
            }
        except:
            continue
    return Response(data)

@api_view(['POST'])
def register_unknown(request):
    """ Auto-registers a new unknown person from the camera feed. """
    embedding = request.data.get('embedding')
    snapshot = request.data.get('snapshot')
    camera_id = request.data.get('camera_id')
    
    if not embedding:
        return Response({"error": "No embedding provided"}, status=400)
        
    try:
        redis_client = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
        
        # Rate limiter per camera (skip if called < 5s ago)
        last_reg = redis_client.get(f"last_unknown_registration:{camera_id}")
        if last_reg:
            try:
                p = TrackedPerson.objects.get(id=int(last_reg))
                return Response({
                    "person_id": p.id,
                    "name": p.name,
                    "employee_id": p.employee_id,
                    "is_new": False
                })
            except:
                pass
                
        # 0. Match against KNOWN/registered people first — a real person must never be re-created as a John Doe.
        KNOWN_MATCH_THRESHOLD = 0.45
        known_people = TrackedPerson.objects.exclude(classification__in=['unknown', 'unknown_archived'])
        k_rows, k_owner = [], []
        for kp in known_people:
            for v in _person_embeddings(kp):
                k_rows.append(v); k_owner.append(kp)
        if k_rows:
            k_sims = cosine_similarity(embedding, np.array(k_rows))
            k_best = int(np.argmax(k_sims))
            if float(k_sims[k_best]) > KNOWN_MATCH_THRESHOLD:
                kp = k_owner[k_best]
                return Response({
                    "person_id": kp.id,
                    "name": kp.name,
                    "employee_id": kp.employee_id,
                    "classification": kp.classification,
                    "is_known": True,
                })

        # 1. Find in DB if already returning (only recent 30 mins)
        recent_time = timezone.now() - timedelta(minutes=30)
        unknowns = TrackedPerson.objects.filter(classification__in=['unknown', 'unknown_archived'], created_at__gte=recent_time)
        
        cached_identities = []
        cached_embeddings = []
        for u in unknowns:
            if u.embedding_data and u.embedding_data != "[]":
                try:
                    emb_list = json.loads(u.embedding_data)
                    cached_embeddings.append(emb_list)
                    cached_identities.append(u)
                except:
                    pass
                    
        is_new = True
        matched_person = None
        
        if cached_embeddings:
            db_matrix = np.array(cached_embeddings)
            sims = cosine_similarity(embedding, db_matrix)
            best_idx = np.argmax(sims)
            max_score = sims[best_idx]
            
            if max_score > 0.55:
                matched_person = cached_identities[best_idx]
                is_new = False
                
        if not is_new and matched_person:
            # Returning unknown
            if matched_person.classification == 'unknown_archived':
                matched_person.classification = 'unknown'
                matched_person.save()
            person_id = matched_person.id
            name = matched_person.name
            employee_id = matched_person.employee_id
            
        else:
            # Cap check: limit DB bloat
            recent_hour = timezone.now() - timedelta(hours=1)
            unknown_count = TrackedPerson.objects.filter(classification='unknown', created_at__gte=recent_hour).count()
            if unknown_count > 100 and matched_person is None and len(cached_identities) > 0:
                # Force match to most similar recent even if below threshold to prevent bloat
                matched_person = cached_identities[best_idx]
                person_id = matched_person.id
                name = matched_person.name
                employee_id = matched_person.employee_id
            else:
                # Create new unknown
                counter = redis_client.incr("unknown_counter")
                
                name = f"John Doe #{counter}"
                employee_id = f"UNK-{int(time.time())}"
                email = f"{employee_id}@codewatch.com"
            
            matched_person = TrackedPerson.objects.create(
                name=name,
                employee_id=employee_id,
                email=email,
                role="unknown",
                department="Unregistered",
                classification="unknown",
                embedding_data=json.dumps(embedding),
                gender="male"
            )
            
            if snapshot:
                try:
                    format, imgstr = snapshot.split(';base64,') if ';base64,' in snapshot else ('', snapshot)
                    ext = format.split('/')[-1] if format else 'jpg'
                    filename = f"unk_{matched_person.id}.{ext}"
                    data = ContentFile(base64.b64decode(imgstr), name=filename)
                    matched_person.profile_picture = data
                    matched_person.save()
                except Exception as snap_e:
                    print(f"Error saving snapshot for unknown: {snap_e}")
                    
            person_id = matched_person.id
            name = matched_person.name
            employee_id = matched_person.employee_id
            
        # Write to Redis
        try:
            redis_data = json.dumps({
                "camera_id": camera_id,
                "last_seen_timestamp": time.time(),
                "name": name,
                "id": person_id,
                "embedding": embedding,
                "confidence": 0.0
            })
            redis_client.setex(f"global_identity:{person_id}", 30, redis_data)
            redis_client.setex(f"last_unknown_registration:{camera_id}", 5, person_id)
        except Exception as e:
            print(f"Redis write error in register_unknown: {e}")
            
        return Response({
            "person_id": person_id,
            "name": name,
            "employee_id": employee_id,
            "is_new": is_new
        })
        
    except Exception as e:
        print(f"Error in register_unknown: {e}")
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_people_db(request):
    """ Returns the raw list of people stored in the Database. """
    role, dept = _requester_scope(request)
    people = TrackedPerson.objects.all().order_by('-id')  # Newest first
    if role == 'department-head':
        people = people.filter(_person_scope_q(dept))
    data = []
    for p in people:
        # Count stored face embeddings, supporting BOTH the single flat [512] form (from Add Member)
        # and the multi-embedding nested [[512], ...] form (from Edit Photos / promotions). The old
        # check only matched len==512, so multi-embedding people wrongly showed "No Embedding".
        emb_count = 0
        if p.embedding_data and p.embedding_data not in ('', '[]'):
            try:
                raw = json.loads(p.embedding_data)
                if isinstance(raw, list) and raw:
                    emb_count = 1 if isinstance(raw[0], (int, float)) else sum(1 for v in raw if isinstance(v, list))
            except Exception:
                emb_count = 0
        if emb_count == 0:
            status_text = "No Embedding"
        elif emb_count == 1:
            status_text = "Encoded (512-D)"
        else:
            status_text = f"Encoded (512-D × {emb_count})"

        violation_count = ViolationLog.objects.filter(person=p).count()
        photo_url = p.profile_picture.url if p.profile_picture else None
        data.append({
            "id": p.id,
            "name": p.name,
            "employee_id": p.employee_id,
            "email": p.email,
            "department": p.department,
            "role": p.role,
            "classification": p.classification,
            "violation_count": violation_count,
            "photo_url": photo_url,
            "created_at": p.created_at,
            "status": status_text,
            "phone": p.phone or "",
            "contact_email": p.contact_email or "",
            "address": p.address or ""
        })
    return Response(data)


@api_view(['POST'])
def update_person_info(request, person_id):
    """ Updates a person's editable contact / profile details (name, personal email, phone,
        department, address). Used by the Edit modal in Manage People. """
    try:
        person = TrackedPerson.objects.get(id=person_id)
    except TrackedPerson.DoesNotExist:
        return Response({"status": "error", "message": "Person not found"}, status=404)

    data = request.data
    if (data.get('name') or '').strip():
        person.name = data['name'].strip()
    if 'department' in data and (data.get('department') or '').strip():
        person.department = data['department'].strip()
    if 'phone' in data:
        person.phone = (data.get('phone') or '').strip() or None
    if 'address' in data:
        person.address = (data.get('address') or '').strip() or None
    if 'contact_email' in data:
        ce = (data.get('contact_email') or '').strip()
        if ce:
            try:
                validate_email(ce)
            except ValidationError:
                return Response({"status": "error", "message": "Please enter a valid personal email address."}, status=400)
            person.contact_email = ce
        else:
            person.contact_email = None
    person.save()
    return Response({"status": "success", "message": "Details updated."})


@api_view(['POST'])
def set_person_classification(request, person_id):
    """ Manually set a person's classification from the Manage People page,
        keeping the blacklist table in sync. """
    try:
        person = TrackedPerson.objects.get(id=person_id)
    except TrackedPerson.DoesNotExist:
        return Response({"status": "error", "message": "Person not found"}, status=404)

    classification = (request.data.get('classification') or '').lower()
    valid = [
        'unknown', 'known', 'blacklisted', 'visitor',
        'student', 'employee',
        'employee_admin', 'employee_ssd', 'employee_dept_head', 'employee_guard',
    ]
    if classification not in valid:
        return Response({"status": "error", "message": "Invalid classification"}, status=400)

    if classification == 'blacklisted':
        entry = Blacklist.objects.filter(person=person).first()
        if entry:
            entry.is_active = True
            entry.save()
        else:
            Blacklist.objects.create(
                person=person,
                reason='Set blacklisted from Manage People',
                blacklist_type='manual',
                violation_threshold=0,
                added_by=request.user if request.user.is_authenticated else None
            )
    else:
        Blacklist.objects.filter(person=person, is_active=True).update(is_active=False)

    person.classification = classification
    person.save()
    return Response({"status": "success"})

@api_view(['POST', 'DELETE'])
def delete_person(request, person_id):
    """ Permanently delete a tracked person. Cascades to their violations, movement
        logs, blacklist and visitor entries (per the model's FK on_delete=CASCADE). """
    try:
        person = TrackedPerson.objects.get(id=person_id)
    except TrackedPerson.DoesNotExist:
        return Response({"status": "error", "message": "Person not found"}, status=404)
    name = person.name
    person.delete()
    return Response({"status": "success", "message": f"{name} deleted."})
