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
from .models import TrackedPerson, ViolationLog, Camera, IncidentReport, Notification, Violation, UserProfile, Blacklist, MovementLog, VisitorLog
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

# --- Send Report recipients ---------------------------------------------
# For the demo, point every role at the inbox you'll show on screen.
# (Later you can give each role its own address.)
_DEMO_INBOX = 'your-demo-inbox@gmail.com'   # <-- replace with a real inbox

REPORT_ROLE_EMAILS = {
    'admin':          [_DEMO_INBOX],
    'ssd':            [_DEMO_INBOX],
    'security':       [_DEMO_INBOX],
    'departmenthead': [_DEMO_INBOX],
    'depthead':       [_DEMO_INBOX],
    'guard':          [_DEMO_INBOX],
}

def _resolve_report_recipients(raw):
    """Comma/semicolon list of role names and/or emails -> clean email list."""
    out = []
    for token in (raw or '').replace(';', ',').split(','):
        t = token.strip()
        if not t:
            continue
        if '@' in t:                       # already an email
            out.append(t)
            continue
        key = ''.join(ch for ch in t.lower() if ch.isalnum())  # "Department Head" -> "departmenthead"
        out.extend(REPORT_ROLE_EMAILS.get(key, []))
    seen = set()
    return [e for e in out if not (e in seen or seen.add(e))]
# ------------------------------------------------------------------------

try:
    face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
except Exception as e:
    print(f"Failed to initialize FaceAnalysis: {e}")
    face_app = None

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')

    # Validate email format
    try:
        validate_email(email)
    except ValidationError:
        return Response({"message": "Invalid email format"}, status=400)

    user = (User.objects.filter(email__iexact=email).first()
            or User.objects.filter(username__iexact=email).first())
    # One generic message for both "no such account" and "wrong password" so the endpoint
    # can't be used to enumerate which emails are registered.
    if user is None or not user.check_password(password):
        return Response({"message": "Invalid email or password."}, status=400)

    # Authenticated. Make sure they have a profile/role.
    try:
        profile = user.userprofile
        role = profile.role
    except Exception as e:
        print(f"DEBUG: Profile Error: {e}")
        return Response({"message": "User profile not configured."}, status=400)

    # Issue (or reuse) the API token the SPA sends back as `Authorization: Token <key>`.
    token, _ = Token.objects.get_or_create(user=user)

    # Resolve department + employee_id from the profile / TrackedPerson (matched by email).
    person = TrackedPerson.objects.filter(email__iexact=user.email).first() if user.email else None
    department = getattr(profile, 'department', None) or (person.department if person else None)
    employee_id = person.employee_id if person else None

    return Response({
        "status": "success",
        "token": token.key,
        "userType": role,
        "userName": user.username.split('@')[0],
        "userEmail": user.email or email,
        "department": department,
        "employeeId": employee_id,
    }, status=200)

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

def cosine_similarity(target_emb, db_matrix):
    target = np.array(target_emb, dtype=np.float32).flatten()
    norm_db = np.linalg.norm(db_matrix, axis=1, keepdims=True)
    norm_target = np.linalg.norm(target)
    if norm_target == 0: return np.zeros(db_matrix.shape[0])
    sims = np.dot(db_matrix, target) / (norm_db.flatten() * norm_target)
    return sims

@api_view(['POST'])
def register_unknown(request):
    """ Auto-registers a new unknown person from the camera feed. """
    embedding = request.data.get('embedding')
    snapshot = request.data.get('snapshot')
    camera_id = request.data.get('camera_id')
    
    if not embedding:
        return Response({"error": "No embedding provided"}, status=400)
        
    try:
        redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        
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

# --- 2. DASHBOARD ENDPOINTS ---

@api_view(['GET'])
def get_recent_activity(request):
    """ Returns recent logs for tables. """
    logs = ViolationLog.objects.all().order_by('-timestamp')[:10]
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "timestamp": log.timestamp,
            "violation_type": log.violation_type,
            "person_name": log.person.name if log.person else "Unknown",
            "snapshot_url": log.snapshot_path.url if log.snapshot_path else None
        })
    return Response(data)

@api_view(['GET'])
def get_dashboard_stats(request):
    """ Real dashboard data: stat cards, people-by-category pie,
        12-month line, 6-month by-type trend, and 53-week heatmap. """
    from django.db.models import Count, Q
    from django.db.models.functions import TruncMonth, TruncDate
    from django.utils import timezone
    from datetime import timedelta
    from collections import defaultdict
    import calendar

    now = timezone.now()

    # Department-Head scoping: every query below runs over their department + unknowns.
    role, _dept = _requester_scope(request)
    _dh = (role == 'department-head')
    _P = TrackedPerson.objects.filter(_person_scope_q(_dept)) if _dh else TrackedPerson.objects
    _V = ViolationLog.objects.filter(_person_scope_q(_dept, 'person__')) if _dh else ViolationLog.objects

    # ---- Stat cards (all real) ----
    total_people = _P.count()
    total_violations = _V.count()
    violators = _P.filter(violationlog__isnull=False).distinct().count()
    non_violators_stat = total_people - violators

    # ---- Pie: tracked people by category (mutually exclusive) ----
    blacklisted = _P.filter(classification__iexact='blacklisted').count()
    visitors = _P.filter(classification__iexact='visitor').count()
    unauthorized = _P.filter(classification__iexact='unknown').count()
    remaining = _P.exclude(
        Q(classification__iexact='blacklisted') |
        Q(classification__iexact='visitor') |
        Q(classification__iexact='unknown')
    )
    dress_ids = set(remaining.filter(
        Q(classification__icontains='dress') |
        Q(violationlog__violation_type__icontains='dress')
    ).values_list('id', flat=True))
    dresscode = len(dress_ids)
    pie_non_violators = remaining.count() - dresscode

    pie_labels = ["Non-Violators", "Visitors", "Unauthorized", "Dress-Code", "Blacklisted"]
    pie_data = [pie_non_violators, visitors, unauthorized, dresscode, blacklisted]

    # ---- Last 12 calendar months, oldest -> newest ----
    seq = []
    yy, mm = now.year, now.month
    for _ in range(12):
        seq.append((yy, mm))
        mm -= 1
        if mm == 0:
            mm = 12
            yy -= 1
    seq.reverse()

    # ---- Line: total violations per month (last 12 months) ----
    month_map = {}
    for r in (_V
              .annotate(b=TruncMonth('timestamp'))
              .values('b')
              .annotate(count=Count('id'))):
        if r['b']:
            month_map[(r['b'].year, r['b'].month)] = r['count']
    line_labels = [calendar.month_abbr[m] for (y, m) in seq]
    line_data = [month_map.get((y, m), 0) for (y, m) in seq]

    # ---- Per-card trends (% vs last month + 6-month sparkline) ----
    vmonth = {}
    for r in (_V
              .annotate(b=TruncMonth('timestamp'))
              .values('b')
              .annotate(count=Count('person', distinct=True))):
        if r['b']:
            vmonth[(r['b'].year, r['b'].month)] = r['count']
    violators_series = [vmonth.get((y, m), 0) for (y, m) in seq]

    def _trend(series12):
        counts = list(series12 or [])
        if len(counts) < 2 or sum(counts) == 0:
            return '', []
        last, prev = counts[-1], counts[-2]
        if prev > 0:
            change = round((last - prev) / prev * 100)
            pct = f"{'+' if change >= 0 else ''}{change}%"
        else:
            pct = '+100%' if last > 0 else '0%'
        return pct, counts[-6:]

    unauth_pct, unauth_spark = _trend(line_data)
    viol_pct, viol_spark = _trend(violators_series)

    from django.core.exceptions import FieldError
    try:
        reg_month = {}
        for r in (_P
                  .annotate(b=TruncMonth('created_at'))
                  .values('b')
                  .annotate(count=Count('id'))):
            if r['b']:
                reg_month[(r['b'].year, r['b'].month)] = r['count']
        baseline = total_people - sum(reg_month.values())
        cum = baseline
        tracked_series = []
        for (y, m) in seq:
            cum += reg_month.get((y, m), 0)
            tracked_series.append(cum)
    except FieldError:
        tracked_series = [total_people] * len(seq)
    victors_pct, victors_spark = _trend(tracked_series)

    from django.db.models import Min
    first_v = {}
    for r in _V.values('person_id').annotate(f=Min('timestamp')):
        if r['f']:
            first_v[r['person_id']] = (r['f'].year, r['f'].month)
    fv_m = {}
    for ym in first_v.values():
        fv_m[ym] = fv_m.get(ym, 0) + 1
    vbase = violators - sum(fv_m.get((y, m), 0) for (y, m) in seq)
    vcum = vbase
    violators_cum = []
    for (y, m) in seq:
        vcum += fv_m.get((y, m), 0)
        violators_cum.append(vcum)
    nonviol_series = [max(t - v, 0) for t, v in zip(tracked_series, violators_cum)]
    nonviol_pct, nonviol_spark = _trend(nonviol_series)

    # ---- Trend: violations by TYPE per month (last 6 months) ----
    vtype_rows = (_V
                  .values('violation_type')
                  .annotate(c=Count('id'))
                  .order_by('-c'))
    vtype_labels = [(r['violation_type'] or 'Unknown') for r in vtype_rows]
    six = seq[-6:]
    trend_labels = [calendar.month_abbr[m] for (y, m) in six]
    by_type = defaultdict(dict)
    for r in (_V
              .annotate(b=TruncMonth('timestamp'))
              .values('b', 'violation_type')
              .annotate(count=Count('id'))):
        if r['b']:
            t = r['violation_type'] or 'Unknown'
            by_type[t][(r['b'].year, r['b'].month)] = r['count']
    palette = ['#7987FF', '#E697FF', '#FFA5CB', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']
    trend_datasets = []
    for i, t in enumerate(vtype_labels):
        trend_datasets.append({
            "label": t,
            "data": [by_type.get(t, {}).get((y, m), 0) for (y, m) in six],
            "color": palette[i % len(palette)],
        })

    # ---- Heatmap: 53-week grid, real daily intensity ----
    start_day = (now - timedelta(days=371)).date()
    day_map = {}
    for r in (_V
              .filter(timestamp__date__gte=start_day)
              .annotate(d=TruncDate('timestamp'))
              .values('d')
              .annotate(count=Count('id'))):
        if r['d']:
            day_map[r['d']] = r['count']
    timeline = []
    for week in range(53):
        for day in range(7):
            the_date = start_day + timedelta(days=week * 7 + day)
            c = day_map.get(the_date, 0)
            intensity = 0 if c == 0 else 1 if c <= 2 else 2 if c <= 5 else 3
            timeline.append({"week": week, "day": day, "intensity": intensity})

    return Response({
        "stats": {
            "nonViolators": {"value": non_violators_stat, "percentageChange": nonviol_pct, "miniChartData": nonviol_spark},
            "unauthorized": {"value": total_violations, "percentageChange": unauth_pct, "miniChartData": unauth_spark},
            "violators": {"value": violators, "percentageChange": viol_pct, "miniChartData": viol_spark},
            "victors": {"value": total_people, "percentageChange": victors_pct, "miniChartData": victors_spark},
        },
        "pie_chart": {"labels": pie_labels, "data": pie_data},
        "line": {"labels": line_labels, "data": line_data},
        "trend": {"labels": trend_labels, "datasets": trend_datasets, "total": total_violations},
        "timeline": timeline,
    })

# --- 3. ANALYTICS ENDPOINTS (THIS WAS MISSING!) ---

@api_view(['GET'])
def get_violation_stats(request):
    """ Returns top violators. """
    stats = TrackedPerson.objects.annotate(total=Count('violationlog')).order_by('-total')
    data = []
    for p in stats:
        if p.total > 0:
            data.append({
                "id": p.id,
                "name": p.name,
                "count": p.total,
                "last_seen": p.created_at
            })
    return Response(data)

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
def add_camera(request):
    """ Saves a new camera from the React Modal. """
    try:
        data = request.data
        Camera.objects.create(
            name=data.get('name'),
            camera_id=data.get('camera_id'),
            location=data.get('location'),
            ip_address=data.get('ip_address'),
            status=data.get('status'),
            stream_url=data.get('stream_url')
        )
        return Response({"status": "success", "message": "Camera added!"})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['GET'])
def get_server_ip(request):
    """ Best-effort current LAN IP of this machine, so the Add Camera modal can show
        the exact address to point Larix at (it changes with the network/hotspot). """
    import socket
    ip = '127.0.0.1'
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))   # picks the outbound interface; sends nothing
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            ip = '127.0.0.1'
    return Response({"ip": ip})

@api_view(['POST'])
def camera_heartbeat(request):
    """ FinalSystem pings this while it's actively pulling frames from a camera. """
    from django.utils import timezone
    cam_id = request.data.get('camera_id')
    if not cam_id:
        return Response({"status": "error", "message": "camera_id required"}, status=400)
    updated = Camera.objects.filter(camera_id=cam_id).update(last_heartbeat=timezone.now())
    return Response({"status": "success", "updated": updated})

@api_view(['GET'])
def get_cameras(request):
    """ Returns cameras + a live `is_online` flag based on recent heartbeats. """
    from django.utils import timezone
    from datetime import timedelta
    cameras = Camera.objects.all().order_by('-created_at')
    online_cutoff = timezone.now() - timedelta(seconds=30)
    data = list(cameras.values())
    for row in data:
        hb = row.get('last_heartbeat')
        row['is_online'] = bool(hb and hb >= online_cutoff)
    return Response(data)

@api_view(['PUT', 'DELETE'])
def manage_camera_detail(request, camera_id):
    """ Updates or deletes a specific camera. """
    try:
        camera = Camera.objects.get(camera_id=camera_id)
        
        if request.method == 'PUT':
            data = request.data
            camera.name = data.get('name', camera.name)
            camera.location = data.get('location', camera.location)
            camera.ip_address = data.get('ip_address', camera.ip_address)
            camera.status = data.get('status', camera.status)
            camera.stream_url = data.get('stream_url', camera.stream_url)
            camera.save()
            return Response({"status": "success", "message": "Camera updated"})
            
        elif request.method == 'DELETE':
            camera.delete()
            return Response({"status": "success", "message": "Camera deleted"})
            
    except Camera.DoesNotExist:
        return Response({"status": "error", "message": "Camera not found"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['POST'])
def user_heartbeat(request):
    """ Pinged every ~20s while a user has the app open. Matches on email OR username. """
    from django.utils import timezone
    from django.db.models import Q
    ident = (request.data.get('email') or request.data.get('username') or '').strip()
    if not ident:
        return Response({"status": "error", "message": "identifier required"}, status=400)
    updated = UserProfile.objects.filter(
        Q(user__email__iexact=ident) | Q(user__username__iexact=ident)
    ).update(last_seen=timezone.now())
    return Response({"status": "success", "updated": updated, "ident": ident})

@api_view(['GET'])
def get_users(request):
    """ Returns all users + a live `is_online` flag based on recent heartbeats. """
    from django.utils import timezone
    from datetime import timedelta
    profiles = UserProfile.objects.select_related('user').all()
    online_cutoff = timezone.now() - timedelta(seconds=60)
    data = []
    for p in profiles:
        last_seen = p.last_seen
        data.append({
            "id": p.user.id,
            "username": p.user.username,
            "email": p.user.email,
            "role": p.role,
            "department": p.department,
            "is_active": p.user.is_active,
            "last_login": p.user.last_login,
            "last_seen": last_seen,
            "is_online": bool(last_seen and last_seen >= online_cutoff),
        })
    return Response(data)

@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAdminRole])
def update_user_role(request, user_id):
    """ Updates a user's role/status, or permanently deletes the user. """
    try:
        user = User.objects.get(id=user_id)

        # --- DELETE: remove the user (and their linked profile) ---
        if request.method == 'DELETE':
            username = user.username
            try:
                user.userprofile.delete()
            except Exception:
                pass
            user.delete()
            return Response({"status": "success", "message": f"User '{username}' deleted"})

        # --- PATCH: update role and/or active status ---
        profile = user.userprofile

        if 'role' in request.data:
            profile.role = request.data['role']
            profile.save()

        if 'is_active' in request.data:
            user.is_active = request.data['is_active']
            user.save()

        return Response({"status": "success", "message": "User updated"})
    except User.DoesNotExist:
        return Response({"status": "error", "message": "User not found"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['GET'])
def get_analytics_filters(request):
    role, dept = _requester_scope(request)
    if role == 'department-head':
        departments = [dept] if dept else []
        roles = sorted({r for r in TrackedPerson.objects.values_list('role', flat=True) if r})
        return Response({"departments": departments, "roles": roles})
    departments = sorted({d for d in TrackedPerson.objects.values_list('department', flat=True) if d})
    roles = sorted({r for r in TrackedPerson.objects.values_list('role', flat=True) if r})
    return Response({"departments": departments, "roles": roles})

@api_view(['POST'])
def get_analytics_data(request):
    """
    Returns filtered counts for the Analytics Page.
    """
    filters = request.data
    
    # 1. Base Query
    people = TrackedPerson.objects.all()
    logs = ViolationLog.objects.all()

    # Department-Head scoping (forced — overrides any department filter sent by the client)
    role, _dept = _requester_scope(request)
    is_dept_head = (role == 'department-head')
    if is_dept_head:
        people = people.filter(_person_scope_q(_dept))
        logs = logs.filter(_person_scope_q(_dept, 'person__'))

    # 2. Apply Filters
    # Filter by Department (skipped for department-heads — already locked to their own)
    if not is_dept_head and filters.get('department') and len(filters['department']) > 0:
        people = people.filter(department__in=filters['department'])
        logs = logs.filter(person__department__in=filters['department'])

    # Filter by Gender (case-insensitive)
    if filters.get('gender') and len(filters['gender']) > 0:
        genders = [g.lower() for g in filters['gender']]
        people = people.annotate(_g=Lower('gender')).filter(_g__in=genders)
        logs = logs.annotate(_pg=Lower('person__gender')).filter(_pg__in=genders)

    # Filter by User Type / Role (case-insensitive)
    if filters.get('userType') and len(filters['userType']) > 0:
        roles = [r.lower() for r in filters['userType']]
        people = people.annotate(_r=Lower('role')).filter(_r__in=roles)
        logs = logs.annotate(_pr=Lower('person__role')).filter(_pr__in=roles)

    # Filter by Camera (scope everything to one camera's activity)
    camera_id = (filters.get('cameraId') or '').strip()
    if camera_id:
        from .models import MovementLog, Camera
        from django.db.models import Q
        cam = Camera.objects.filter(camera_id=camera_id).first()
        cam_name = cam.name if cam else None

        # Violations recorded by this camera (ViolationLog has a camera FK)
        logs = logs.filter(camera__camera_id=camera_id)

        # People seen at this camera — movement logs key off the FK or the stored camera_name
        mv_q = Q(camera__camera_id=camera_id)
        if cam_name:
            mv_q |= Q(camera_name__iexact=cam_name)
        seen_ids = set(MovementLog.objects.filter(mv_q).values_list('person_id', flat=True))
        seen_ids |= set(ViolationLog.objects.filter(camera__camera_id=camera_id).values_list('person_id', flat=True))
        people = people.filter(id__in=seen_ids)

    logs_history = logs  # dept/role/gender applied, all dates — for the trend charts

    # Filter by Date
    if filters.get('startDate'):
        logs = logs.filter(timestamp__date__gte=parse_date(filters['startDate']))
    if filters.get('endDate'):
        logs = logs.filter(timestamp__date__lte=parse_date(filters['endDate']))

    # 3. Calculate Real Counts
    total_people = people.count()
    violators_count = logs.values('person').distinct().count()
    non_violators = total_people - violators_count
    
    # "Unauthorized" -> Let's count people with 'Unauthorized' violation type
    unauthorized = logs.filter(violation_type__icontains="Unauthorized").values('person').distinct().count()
    
    # "Visitors" -> Count people with role 'Visitor'
    visitors = people.filter(role__iexact="visitor").count()

    # "Victors" -> We'll map this to 'Total Tracked' for the demo
    victors = total_people

    today = timezone.localdate()

    # Monthly total violations (last 12 months)
    monthly_qs = logs_history.annotate(m=TruncMonth('timestamp')).values('m').annotate(c=Count('id'))
    month_map = {(r['m'].year, r['m'].month): r['c'] for r in monthly_qs if r['m']}
    buckets = []
    y, m = today.year, today.month
    for i in range(11, -1, -1):
        mm, yy = m - i, y
        while mm <= 0:
            mm += 12
            yy -= 1
        buckets.append((yy, mm))
    monthly_violations = [
        {"month": calendar.month_abbr[mm], "count": month_map.get((yy, mm), 0)}
        for (yy, mm) in buckets
    ]

    # Per-metric monthly series (last 12 months) so each stat card shows its OWN trend
    from .models import VisitorLog

    def _metric_series(qs, date_field='timestamp'):
        rows = (qs.annotate(_mm=TruncMonth(date_field))
                  .values('_mm')
                  .annotate(_cc=Count('person', distinct=True)))
        mp = {(r['_mm'].year, r['_mm'].month): r['_cc'] for r in rows if r['_mm']}
        return [{"month": calendar.month_abbr[mm], "count": mp.get((yy, mm), 0)}
                for (yy, mm) in buckets]

    people_ids = list(people.values_list('id', flat=True))
    monthly_violators    = _metric_series(logs_history)
    monthly_unauthorized = _metric_series(logs_history.filter(violation_type__icontains="Unauthorized"))
    monthly_visitors     = _metric_series(VisitorLog.objects.filter(person_id__in=people_ids), date_field='check_in')

    # Non-Violators series = cumulative tracked people − cumulative distinct violators (filtered)
    from django.core.exceptions import FieldError
    from django.db.models import Min
    try:
        reg_m = {}
        for r in TrackedPerson.objects.filter(id__in=people_ids).annotate(_b=TruncMonth('created_at')).values('_b').annotate(_c=Count('id')):
            if r['_b']:
                reg_m[(r['_b'].year, r['_b'].month)] = r['_c']
        ppl_base = total_people - sum(reg_m.values())
        ppl_cum, ppl_series = ppl_base, []
        for (yy, mm) in buckets:
            ppl_cum += reg_m.get((yy, mm), 0)
            ppl_series.append(ppl_cum)
    except FieldError:
        ppl_series = [total_people] * len(buckets)

    flogs = ViolationLog.objects.filter(person_id__in=people_ids)
    total_violators_all = flogs.values('person_id').distinct().count()
    fv_m = {}
    for r in flogs.values('person_id').annotate(_f=Min('timestamp')):
        if r['_f']:
            key = (r['_f'].year, r['_f'].month)
            fv_m[key] = fv_m.get(key, 0) + 1
    vbase = total_violators_all - sum(fv_m.get((yy, mm), 0) for (yy, mm) in buckets)
    vcum, v_series = vbase, []
    for (yy, mm) in buckets:
        vcum += fv_m.get((yy, mm), 0)
        v_series.append(vcum)

    monthly_nonviolators = [
        {"month": calendar.month_abbr[mm], "count": max(ppl_series[i] - v_series[i], 0)}
        for i, (yy, mm) in enumerate(buckets)
    ]

    # Daily violations (last 53 weeks) -> heatmap grid
    start = today - timedelta(days=370)
    daily_qs = logs_history.filter(timestamp__date__gte=start).annotate(d=TruncDate('timestamp')).values('d').annotate(c=Count('id'))
    daily_counts = {r['d'].isoformat(): r['c'] for r in daily_qs if r['d']}
    timeline = []
    for week in range(53):
        for day in range(7):
            cell_date = start + timedelta(days=week * 7 + day)
            cnt = daily_counts.get(cell_date.isoformat(), 0)
            intensity = 0 if cnt == 0 else (1 if cnt < 3 else 2)
            timeline.append({
                "week": week, "day": day, "intensity": intensity,
                "hour": "12:00", "date": cell_date.isoformat(), "count": cnt
            })

    return Response({
        "nonViolators": non_violators,
        "violators": violators_count,
        "unauthorized": unauthorized,
        "visitors": visitors,
        "victors": victors,
        "monthlyViolations": monthly_violations,
        "monthlyViolators": monthly_violators,
        "monthlyUnauthorized": monthly_unauthorized,
        "monthlyVisitors": monthly_visitors,
        "monthlyNonViolators": monthly_nonviolators,
        "timelineData": timeline,
    })

def _generate_report_pdf(report):
    """Render an IncidentReport to PDF bytes from its stored data (server-side, no browser)."""
    import io, os, json as _json
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
    from django.conf import settings as dj_settings

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle('cw_h1', parent=styles['Heading1'], textColor=colors.HexColor('#3f4299'), fontSize=18)
    h2 = ParagraphStyle('cw_h2', parent=styles['Heading2'], textColor=colors.HexColor('#3f4299'), fontSize=13)
    meta = ParagraphStyle('cw_meta', parent=styles['Normal'], textColor=colors.HexColor('#666666'), fontSize=9)
    mono = ParagraphStyle('cw_mono', parent=styles['Normal'], fontName='Courier', fontSize=9, leading=12)
    story = []

    story.append(Paragraph(f"RPT-{report.id:04d} — {report.subject or 'Report'}", h1))
    created = report.created_at.strftime('%b %d, %Y %H:%M') if getattr(report, 'created_at', None) else ''
    story.append(Paragraph(
        f"Type: {report.report_type or 'General'} | Priority: {report.priority or 'Normal'} | "
        f"Status: {report.status or 'new'} | {created}", meta))
    story.append(Spacer(1, 10))

    if report.message:
        story.append(Paragraph("Report Content", h2))
        safe = (report.message or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>')
        story.append(Paragraph(safe, mono))
        story.append(Spacer(1, 10))

    try:
        adata = _json.loads(report.analytics_json) if report.analytics_json else {}
    except Exception:
        adata = {}

    cards = adata.get('statCardsData') or []
    if cards:
        story.append(Paragraph("Key Metrics", h2))
        rows = [['Metric', 'Value', 'Change']]
        for c in cards:
            rows.append([str(c.get('title', '')), str(c.get('value', '')), str(c.get('percentageChange', '') or '')])
        t = Table(rows, hAlign='LEFT', colWidths=[90*mm, 35*mm, 35*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3f4299')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f4f4fb')]),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    vd = adata.get('violator_details')
    if vd:
        story.append(Paragraph("Subject", h2))
        rows = [
            ['Name', str(vd.get('name', ''))],
            ['ID', str(vd.get('employee_id', ''))],
            ['Department', str(vd.get('department', ''))],
            ['Classification', str(vd.get('classification', ''))],
        ]
        t = Table(rows, hAlign='LEFT', colWidths=[40*mm, 120*mm])
        t.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f4f4fb')),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    moves = adata.get('movement_summary') or []
    if moves:
        story.append(Paragraph("Movement Summary", h2))
        rows = [['Camera', 'Location', 'Entered']]
        for m in moves[:30]:
            ent = str(m.get('entered_at') or '')[:19].replace('T', ' ')
            rows.append([str(m.get('camera_name', '')), str(m.get('location', '')), ent])
        t = Table(rows, hAlign='LEFT', colWidths=[40*mm, 80*mm, 40*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3f4299')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    snaps = adata.get('snapshots') or []
    if snaps:
        media_url = getattr(dj_settings, 'MEDIA_URL', '/media/')
        media_root = getattr(dj_settings, 'MEDIA_ROOT', '')
        imgs = []
        for s in snaps[:4]:
            try:
                idx = s.find(media_url)
                if idx >= 0 and media_root:
                    rel = s[idx + len(media_url):]
                    fpath = os.path.join(media_root, rel)
                    if os.path.exists(fpath):
                        imgs.append(RLImage(fpath, width=42*mm, height=42*mm))
            except Exception:
                continue
        if imgs:
            story.append(Paragraph("Snapshots", h2))
            story.append(Table([imgs], hAlign='LEFT'))

    if len(story) <= 2:
        story.append(Paragraph("No additional content available.", styles['Normal']))

    doc.build(story)
    return buf.getvalue()


@api_view(['POST'])
def send_report(request):
    """
    Saves an incident report from the Modal and emails it to the recipients.
    """
    try:
        data = request.data
        person_id = data.get('personId')

        analytics_str = data.get('analytics_json')
        if person_id and analytics_str:
            import json
            from .models import MovementLog, ViolationLog, TrackedPerson
            try:
                analytics_data = json.loads(analytics_str)
                person = TrackedPerson.objects.get(id=person_id)

                # Fetch movement logs
                movements = MovementLog.objects.filter(person_id=person_id).order_by('entered_at')
                movement_summary = []
                cameras_visited = set()
                total_duration_seconds = 0

                for m in movements:
                    duration = 0
                    if m.exited_at and m.entered_at:
                        duration = (m.exited_at - m.entered_at).total_seconds()
                        total_duration_seconds += duration

                    cameras_visited.add(m.camera_name)
                    movement_summary.append({
                        "camera_name": m.camera_name,
                        "location": m.location_description,
                        "entered_at": m.entered_at.isoformat() if m.entered_at else None,
                        "exited_at": m.exited_at.isoformat() if m.exited_at else None,
                        "duration": duration
                    })

                # Fetch snapshots (the field is snapshot_path on ViolationLog)
                violations = ViolationLog.objects.filter(person_id=person_id).exclude(snapshot_path='')
                snapshots = []
                for v in violations:
                    if v.snapshot_path:
                        snapshots.append(v.snapshot_path.url)

                analytics_data['movement_summary'] = movement_summary
                analytics_data['snapshots'] = snapshots
                analytics_data['total_time_seconds'] = total_duration_seconds
                analytics_data['cameras_visited_count'] = len(cameras_visited)
                analytics_data['violator_details'] = {
                    "name": person.name,
                    "employee_id": person.employee_id,
                    "department": person.department,
                    "classification": person.classification
                }

                analytics_str = json.dumps(analytics_data)
            except Exception as e:
                print(f"Failed to augment analytics_json: {e}")

        # Derive the analytics period from the selected date range (if any).
        resolved_report_type = data.get('reportType')
        _sd = data.get('startDate')
        _ed = data.get('endDate')
        if _sd and _ed:
            try:
                from datetime import datetime as _dt
                span = abs((_dt.strptime(str(_ed), '%Y-%m-%d') - _dt.strptime(str(_sd), '%Y-%m-%d')).days)
                if span <= 1:
                    resolved_report_type = 'daily'
                elif span <= 8:
                    resolved_report_type = 'weekly'
                elif span <= 35:
                    resolved_report_type = 'monthly'
                elif span <= 100:
                    resolved_report_type = 'quarterly'
                elif span <= 200:
                    resolved_report_type = 'half-yearly'
                else:
                    resolved_report_type = 'yearly'
                print(f"[send_report] date span {span}d -> type '{resolved_report_type}'")
            except Exception as _pe:
                print(f"[send_report] period parse failed: {_pe}")
        # Ensure department-head generated reports are properly scoped
        role, _dept = _requester_scope(request)
        final_message = data.get('message')
        if role == 'department-head' and _dept:
            if final_message:
                final_message = final_message.replace('Dept: All', f'Dept: {_dept}')
            if analytics_str:
                try:
                    import json
                    a_data = json.loads(analytics_str)
                    if 'filters' not in a_data:
                        a_data['filters'] = {}
                    if not a_data['filters'].get('department') or len(a_data['filters']['department']) == 0:
                        a_data['filters']['department'] = [_dept]
                    analytics_str = json.dumps(a_data)
                except Exception:
                    pass

        report = IncidentReport.objects.create(
            report_type=resolved_report_type,
            recipients=data.get('recipients'),
            subject=data.get('subject'),
            priority=data.get('priority'),
            message=final_message,
            related_person_id=person_id if person_id else None,
            analytics_json=analytics_str
        )

        # --- Email the report to any recipient that looks like an email address ---
        email_sent = False
        email_error = None
        try:
            to_list = _resolve_report_recipients(data.get('recipients'))
            print(f"[send_report] raw recipients={data.get('recipients')!r} -> resolved={to_list}")
            if to_list:
                from django.core.mail import send_mail
                from django.conf import settings as dj_settings
                # Use the same authenticated address the working violation emails use.
                from_addr = (getattr(dj_settings, 'EMAIL_HOST_USER', None)
                             or getattr(dj_settings, 'DEFAULT_FROM_EMAIL', None))
                priority = data.get('priority') or 'Normal'
                body_lines = [
                    data.get('message') or '',
                    '',
                    f"Type: {data.get('reportType') or 'General'}",
                    f"Priority: {priority}",
                ]
                try:
                    if analytics_str:
                        import json as _json
                        adata = _json.loads(analytics_str)
                        vd = adata.get('violator_details')
                        if vd:
                            body_lines.append(f"Subject of report: {vd.get('name')} ({vd.get('employee_id')}) — {vd.get('department')}")
                        snaps = adata.get('snapshots') or []
                        if snaps:
                            body_lines += ['', 'Snapshots:'] + snaps[:5]
                except Exception:
                    pass
                body_lines += ['', '— Code Watch']
                # --- Build the email and attach report PDFs ---
                from django.core.mail import EmailMessage
                subject_line = f"[Code Watch - {priority}] {data.get('subject') or 'Incident Report'}"
                email = EmailMessage(subject_line, "\n".join(body_lines), from_addr, to_list)
                covered_ids = set()
                # (A) Pixel-perfect PDF captured on the client (Report Details page)
                client_pdf = data.get('client_pdf')
                if client_pdf and client_pdf.get('base64'):
                    try:
                        import base64 as _b64
                        raw = client_pdf['base64']
                        if ',' in raw:
                            raw = raw.split(',', 1)[1]
                        pdf_bytes = _b64.b64decode(raw)
                        fname = client_pdf.get('filename') or 'report.pdf'
                        email.attach(fname, pdf_bytes, 'application/pdf')
                        if client_pdf.get('report_id') is not None:
                            covered_ids.add(client_pdf.get('report_id'))
                        print(f"[send_report] attached client PDF {fname} ({len(pdf_bytes)} bytes)")
                    except Exception as _cp_e:
                        print(f"[send_report] client PDF attach failed: {_cp_e}")
                # (B) Server-generated PDFs for any other attached reports (the picker)
                for rid in (data.get('attached_report_ids') or []):
                    if rid in covered_ids:
                        continue
                    try:
                        rep = IncidentReport.objects.get(id=rid)
                        pdf_bytes = _generate_report_pdf(rep)
                        email.attach(f"RPT-{rep.id:04d}.pdf", pdf_bytes, 'application/pdf')
                        print(f"[send_report] attached server PDF RPT-{rep.id:04d}.pdf ({len(pdf_bytes)} bytes)")
                    except IncidentReport.DoesNotExist:
                        continue
                    except Exception as _sp_e:
                        print(f"[send_report] server PDF for {rid} failed: {_sp_e}")
                print(f"[send_report] sending from={from_addr!r} to={to_list}")
                sent = email.send(fail_silently=False)
                print(f"[send_report] email.send returned {sent} (1 = handed to SMTP)")
                email_sent = bool(sent)
            else:
                email_error = "No valid recipient email address was provided."
                print("[send_report] resolved recipient list is EMPTY -> nothing emailed")
        except Exception as mail_e:
            import traceback
            email_error = str(mail_e)
            print(f"[send_report] EMAIL FAILED: {mail_e}")
            traceback.print_exc()

        return Response({
            "status": "success",
            "report_id": report.id,
            "email_sent": email_sent,
            "email_error": email_error,
        })
    except Exception as e:
        print(f"Report Error: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)
    
    
@api_view(['GET'])
def get_reports(request):
    """ Returns all incident reports from the database. """
    import json
    reports = IncidentReport.objects.select_related('related_person').all().order_by('created_at')
    
    role, dept = _requester_scope(request)

    data = []
    
    counters = {'analytics': 1, 'email': 1, 'violation': 1}
    prefixes = {'analytics': 'ANA', 'email': 'EML', 'violation': 'VIO'}
    
    for r in reports:
        if role == 'department-head' and dept:
            if r.related_person_id:
                if r.related_person.department != dept and r.related_person.classification != 'unknown':
                    continue
            else:
                allowed = False
                try:
                    if r.analytics_json:
                        a_data = json.loads(r.analytics_json)
                        dept_filter = a_data.get('filters', {}).get('department', [])
                        if dept in dept_filter:
                            allowed = True
                except Exception:
                    pass
                
                # Fallback check for older reports without explicit JSON filters
                if not allowed and r.message:
                    if f"Dept: {dept}" in r.message or "Dept: All" in r.message:
                        allowed = True

                if not allowed:
                    continue

        snapshot_url = None
        movement_summary = []
        analytics_data = {}
        try:
            if r.analytics_json:
                analytics_data = json.loads(r.analytics_json)
                if 'snapshots' in analytics_data and len(analytics_data['snapshots']) > 0:
                    snapshot_url = analytics_data['snapshots'][0]
                if 'movement_summary' in analytics_data:
                    movement_summary = analytics_data['movement_summary']
        except Exception:
            analytics_data = {}
            
        # Bucket the report for the Reports filters.
        if r.report_type == 'Violation Feedback':
            category = 'violation'
        elif r.recipients == 'System Archive':
            category = 'analytics'
        elif r.recipients and r.recipients != 'System Archive':
            category = 'email'
        elif snapshot_url or analytics_data.get('snapshots') or r.related_person_id:
            category = 'violation'
        else:
            category = 'analytics'
            
        custom_id = f"{prefixes[category]}-{counters[category]:04d}"
        counters[category] += 1
            
        data.append({
            "id": r.id,
            "custom_id": custom_id,
            "description": r.subject,
            "date": r.created_at,
            "type": r.report_type,
            "category": category,
            "recipients": r.recipients,
            "status": r.status,
            "note": r.resolution_note,
            "is_pinned": r.is_pinned,
            "related_person_id": r.related_person_id,
            "related_person_name": r.related_person.name if r.related_person else None,
            "priority": r.priority,
            "message": r.message,
            "analytics_json": _rel_media(r.analytics_json),
            "snapshot_url": _rel_media(snapshot_url),
            "movement_summary": movement_summary
        })
    # Sort the final list by is_pinned (descending) and created_at (descending)
    data.sort(key=lambda x: (not x['is_pinned'], -x['date'].timestamp()))
    
    return Response(data)

@api_view(['POST'])
def update_report(request, report_id):
    """ Update a report's status/note (+ pin), and optionally blacklist its related person. """
    from django.utils import timezone
    try:
        report = IncidentReport.objects.get(id=report_id)
    except IncidentReport.DoesNotExist:
        return Response({"status": "error", "message": "Report not found"}, status=404)

    status_val = (request.data.get('status') or '').strip().lower()
    if status_val:
        valid = ['new', 'in_review', 'resolved', 'dismissed', 'reviewed', 'archived']
        if status_val not in valid:
            return Response({"status": "error", "message": "Invalid status"}, status=400)
        report.status = status_val
        report.resolved_at = timezone.now() if status_val in ('resolved', 'dismissed', 'archived') else None

    if request.data.get('note') is not None:
        report.resolution_note = request.data.get('note')

    if 'is_pinned' in request.data:
        report.is_pinned = bool(request.data.get('is_pinned'))

    report.save()

    blacklisted = False
    if request.data.get('blacklist') and report.related_person_id:
        person = report.related_person
        entry = Blacklist.objects.filter(person=person).first()
        if entry:
            entry.is_active = True
            entry.save()
        else:
            Blacklist.objects.create(
                person=person,
                reason=f'Blacklisted from report #{report.id}',
                blacklist_type='manual',
                violation_threshold=0,
                added_by=request.user if request.user.is_authenticated else None
            )
        person.classification = 'blacklisted'
        person.save()
        blacklisted = True

    return Response({"status": "success", "blacklisted": blacklisted})

@api_view(['GET'])
def get_report_detail(request, report_id):
    """ Returns full details of a specific incident report """
    import json
    try:
        report = IncidentReport.objects.get(id=report_id)
        
        role, dept = _requester_scope(request)
        if role == 'department-head' and dept:
            if report.related_person_id:
                if report.related_person.department != dept and report.related_person.classification != 'unknown':
                    return Response({"status": "error", "message": "Unauthorized access to report."}, status=403)
            else:
                allowed = False
                try:
                    if report.analytics_json:
                        a_data = json.loads(report.analytics_json)
                        dept_filter = a_data.get('filters', {}).get('department', [])
                        if dept in dept_filter:
                            allowed = True
                except Exception:
                    pass
                if not allowed:
                    return Response({"status": "error", "message": "Unauthorized access to report."}, status=403)
        
        def get_category(r, a_data, s_url):
            if r.report_type == 'Violation Feedback':
                return 'violation'
            if r.recipients == 'System Archive':
                return 'analytics'
            if r.recipients and r.recipients != 'System Archive':
                return 'email'
            if s_url or a_data.get('snapshots') or r.related_person_id:
                return 'violation'
            return 'analytics'

        analytics_data = {}
        snapshot_url = None
        try:
            if report.analytics_json:
                analytics_data = json.loads(report.analytics_json)
                if 'snapshots' in analytics_data and len(analytics_data['snapshots']) > 0:
                    snapshot_url = analytics_data['snapshots'][0]
        except Exception:
            pass
            
        # Normalize any legacy absolute media URLs to relative so images load on LAN clients.
        snapshot_url = _rel_media(snapshot_url)
        if isinstance(analytics_data.get('snapshots'), list):
            analytics_data['snapshots'] = [_rel_media(s) for s in analytics_data['snapshots']]

        my_category = get_category(report, analytics_data, snapshot_url)
        
        # Calculate sequential rank by checking all older reports
        all_older = IncidentReport.objects.filter(created_at__lte=report.created_at).order_by('created_at')
        rank = 0
        for r in all_older:
            r_analytics = {}
            r_snap = None
            try:
                if r.analytics_json:
                    r_analytics = json.loads(r.analytics_json)
                    if 'snapshots' in r_analytics and len(r_analytics['snapshots']) > 0:
                        r_snap = r_analytics['snapshots'][0]
            except Exception: pass
            
            if get_category(r, r_analytics, r_snap) == my_category:
                rank += 1

        prefixes = {'analytics': 'ANA', 'email': 'EML', 'violation': 'VIO'}
        custom_id = f"{prefixes[my_category]}-{rank:04d}"

        return Response({
            "id": report.id,
            "custom_id": custom_id,
            "description": report.subject,
            "date": report.created_at,
            "type": report.report_type,
            "status": report.status or 'new',
            "resolution_note": report.resolution_note or '',
            "is_pinned": report.is_pinned,
            "related_person_id": report.related_person_id,
            "related_person_name": report.related_person.name if report.related_person else None,
            "priority": report.priority,
            "message": report.message,
            "recipients": report.recipients,
            "analytics_json": _rel_media(report.analytics_json),
            "analytics_data": analytics_data
        })
    except IncidentReport.DoesNotExist:
        return Response({"error": "Report not found"}, status=404)

@api_view(['DELETE'])
def delete_report(request, report_id):
    """ Deletes a report by ID. """
    try:
        report = IncidentReport.objects.get(id=report_id)
        report.delete()
        return Response({"status": "success"})
    except IncidentReport.DoesNotExist:
        return Response({"status": "error", "message": "Not found"}, status=404)
    
@api_view(['GET'])
def get_notifications(request):
    """ Notifications for the requesting user: per-user read/cleared state + role targeting. """
    import re
    from django.db.models import Q
    from .models import NotificationState
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
    from .models import NotificationState
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
    from .models import NotificationState
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
    from .models import NotificationState
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

@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """ A user requests a reset. We don't reset here — we notify the admin (admin-only
        notification), who resets it from the Users tab in Manage People. """
    email = (request.data.get('email') or '').strip()
    if not email:
        return Response({"status": "error", "message": "Please enter your email."}, status=400)
    user = User.objects.filter(email__iexact=email).first()
    # Notify the admin only if the account exists, but always return the same response so this
    # endpoint can't be used to enumerate which emails are registered.
    if user:
        Notification.objects.create(
            title="Password Reset Requested",
            message=f"{email} requested a password reset. Reset it from Manage People.",
            notif_type='system',
            target_role='admin'
        )
    return Response({"status": "success", "message": "If that account exists, the administrator has been notified."})


@api_view(['POST'])
@permission_classes([IsAdminRole])
def reset_user_password(request, user_id):
    """ Admin-only: reset a user's password to a random one-time value AND flag the account so
        the user must set their own password on next login. """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"status": "error", "message": "User not found"}, status=404)
    temp_password = secrets.token_urlsafe(9)
    user.set_password(temp_password)
    user.save()
    profile = getattr(user, 'userprofile', None)
    if profile:
        profile.must_change_password = True
        profile.save()
    return Response({
        "status": "success",
        "temp_password": temp_password,
        "message": f"Temporary password for {user.username}: {temp_password} — share it securely; they'll set their own on next login.",
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def password_status(request):
    """ Tells the login page whether this account must change its password first. """
    email = (request.GET.get('email') or '').strip()
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({"must_change_password": False})
    profile = getattr(user, 'userprofile', None)
    return Response({"must_change_password": bool(profile and profile.must_change_password)})


@api_view(['POST'])
@permission_classes([AllowAny])
def set_initial_password(request):
    """ First-login password set. Only works for accounts actually flagged for it,
        so it can't be used to reset arbitrary accounts (no old-password check here). """
    email = (request.data.get('email') or '').strip()
    new_password = request.data.get('password') or ''
    if not email or not new_password:
        return Response({"status": "error", "message": "Email and new password are required."}, status=400)
    if len(new_password) < 8:
        return Response({"status": "error", "message": "Password must be at least 8 characters."}, status=400)
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({"status": "error", "message": "Account not found."}, status=404)
    profile = getattr(user, 'userprofile', None)
    if not profile or not profile.must_change_password:
        return Response({"status": "error", "message": "This account is not awaiting a first-time password set."}, status=400)
    user.set_password(new_password)
    user.save()
    profile.must_change_password = False
    profile.save()
    return Response({"status": "success"})


@api_view(['POST'])
def change_password(request):
    """ Voluntary change: verifies the current password before setting a new one. """
    email = (request.data.get('email') or '').strip()
    old_password = request.data.get('old_password') or ''
    new_password = request.data.get('new_password') or ''
    if not email or not old_password or not new_password:
        return Response({"status": "error", "message": "All fields are required."}, status=400)
    if len(new_password) < 8:
        return Response({"status": "error", "message": "New password must be at least 8 characters."}, status=400)
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({"status": "error", "message": "Account not found."}, status=404)
    if not user.check_password(old_password):
        return Response({"status": "error", "message": "Your current password is incorrect."}, status=400)
    user.set_password(new_password)
    user.save()
    profile = getattr(user, 'userprofile', None)
    if profile and profile.must_change_password:
        profile.must_change_password = False
        profile.save()
    return Response({"status": "success"})

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


RECORDED_CLIPS = [
    "/media/2.mp4",
    "/media/2.mp4",
]

@api_view(['GET'])
def get_live_tracking_feed(request, person_id):
    """
    Returns the live tracking feed for a specific person.
    """
    try:
        redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
        # Check if person is currently being tracked
        global_id_data = redis_client.get(f"global_identity:{person_id}")
        track_camera = redis_client.get(f"track_camera:{person_id}")
        is_live = bool(global_id_data) or bool(track_camera)
        
        person = TrackedPerson.objects.get(id=person_id)
        violation_count = ViolationLog.objects.filter(person=person).count()
        movement_history = MovementLog.objects.filter(person=person).order_by('-entered_at')
        
        total_time_on_premises = 0
        cameras_visited = movement_history.values('camera').distinct().count()
        
        movement_data = []
        for m in movement_history:
            duration_seconds = 0
            if m.exited_at:
                duration_seconds = (m.exited_at - m.entered_at).total_seconds()
                total_time_on_premises += duration_seconds
                
            movement_data.append({
                "camera_name": m.camera_name,
                "location_description": m.location_description,
                "entered_at": m.entered_at,
                "exited_at": m.exited_at,
                "duration_seconds": duration_seconds,
                "is_violation": m.is_violation
            })
            
        profile_url = person.profile_picture.url if person.profile_picture else None

        base_response = {
            "person": {
                "name": person.name,
                "employee_id": person.employee_id,
                "gender": person.gender,
                "department": person.department,
                "semester": person.semester,
                "classification": person.classification,
                "violation_count": violation_count,
                "profile_picture": profile_url
            },
            "movement_history": movement_data,
            "total_time_on_premises": total_time_on_premises,
            "cameras_visited": cameras_visited
        }
        
        # Determine tracking feed URL based on camera presence
        current_camera = track_camera if track_camera else None
            
        if not current_camera:
            last_move = movement_history.first()
            if last_move and last_move.camera:
                current_camera = last_move.camera.camera_id
                
        base_response["current_camera_id"] = current_camera
        base_response["tracking_feed_url"] = f"/live_feed_track_{person_id}.jpg" if current_camera else None
        
        if is_live:
            cam_id = track_camera
            if not cam_id and global_id_data:
                try:
                    cam_id = json.loads(global_id_data).get("camera_id")
                except:
                    pass
            cam_name, stream_url, location = "Unknown Camera", "", "Unknown Location"
            if cam_id:
                try:
                    cam = Camera.objects.get(camera_id=cam_id)
                    cam_name, stream_url, location = cam.name, cam.stream_url, cam.location
                except:
                    pass
            base_response.update({
                "active_camera_name": cam_name,
                "stream_url": stream_url,
                "location": location,
                "current_location": location,
                "is_live": True
            })
            return Response(base_response)
            
        # Fallback to DB
        latest_log = ViolationLog.objects.filter(person_id=person_id).order_by('-timestamp').first()
        if latest_log and latest_log.camera:
            base_response.update({
                "active_camera_name": latest_log.camera.name,
                "stream_url": latest_log.camera.stream_url,
                "location": latest_log.camera.location,
                "last_seen": latest_log.timestamp,
                "violation_type": latest_log.violation_type,
                "is_live": False
            })
            return Response(base_response)
        elif latest_log:
             base_response.update({
                "active_camera_name": "Unknown Camera",
                "stream_url": "",
                "location": "Unknown Location",
                "last_seen": latest_log.timestamp,
                "violation_type": latest_log.violation_type,
                "is_live": False
            })           
             return Response(base_response)
            
        base_response.update({
            "is_live": False,
            "active_camera_name": "Unknown",
            "location": "Unknown",
            "stream_url": ""
        })
        return Response(base_response)
    except TrackedPerson.DoesNotExist:
        return Response({"status": "error", "message": "Person not found"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


@api_view(['POST'])
def live_track_start(request):
    try:
        person_id = request.data.get('person_id')
        if not person_id:
            return Response({"status": "error", "message": "person_id is required"}, status=400)
            
        redis_client = redis.Redis(host='localhost', port=6379, db=0)
        redis_client.set("track_highlight", str(person_id), ex=3600)
        return Response({"status": "success"})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


@api_view(['POST'])
def live_track_stop(request):
    try:
        redis_client = redis.Redis(host='localhost', port=6379, db=0)
        redis_client.delete("track_highlight")
        return Response({"status": "success"})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


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

@api_view(['POST'])
def submit_feedback(request):
    from .models import Feedback, ViolationLog
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


@api_view(['POST'])
def log_movement(request):
    try:
        person_id = request.data.get('person_id')
        camera_id = request.data.get('camera_id')
        action = request.data.get('action') # 'enter' or 'exit'
        
        if not all([person_id, camera_id, action]):
            return Response({"error": "Missing parameters"}, status=400)
            
        person = TrackedPerson.objects.get(id=person_id)
        camera = Camera.objects.get(camera_id=camera_id)
        
        if action == 'enter':
            movement = MovementLog.objects.create(
                person=person,
                camera=camera,
                camera_name=camera.name,
                location_description=camera.location
            )
        elif action == 'exit':
            movement = MovementLog.objects.filter(person=person, exited_at__isnull=True).order_by('-entered_at').first()
            if movement:
                movement.exited_at = timezone.now()
                movement.save()
            else:
                return Response({"error": "No open movement log found"}, status=404)
        else:
            return Response({"error": "Invalid action"}, status=400)
            
        return Response({
            "id": movement.id,
            "person": person.name,
            "camera_name": movement.camera_name,
            "entered_at": movement.entered_at,
            "exited_at": movement.exited_at
        })
    except (TrackedPerson.DoesNotExist, Camera.DoesNotExist):
        return Response({"error": "Person or Camera not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(['GET'])
def get_movement_history(request, person_id):
    try:
        person = TrackedPerson.objects.get(id=person_id)
        movements = MovementLog.objects.filter(person=person).order_by('-entered_at')
        
        total_time_on_premises = 0
        cameras_visited = movements.values('camera').distinct().count()
        
        data = []
        for m in movements:
            duration_seconds = 0
            if m.exited_at:
                duration_seconds = (m.exited_at - m.entered_at).total_seconds()
                total_time_on_premises += duration_seconds
                
            data.append({
                "camera_name": m.camera_name,
                "location_description": m.location_description,
                "entered_at": m.entered_at,
                "exited_at": m.exited_at,
                "duration_seconds": duration_seconds,
                "is_violation": m.is_violation
            })
            
        return Response({
            "movement_history": data,
            "total_time_on_premises": total_time_on_premises,
            "cameras_visited": cameras_visited
        })
    except TrackedPerson.DoesNotExist:
        return Response({"error": "Person not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=400)


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

    redis_client = redis.Redis(host='localhost', port=6379, db=0)

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
            redis_client = redis.Redis(host='localhost', port=6379, db=0)
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
            redis_client = redis.Redis(host='localhost', port=6379, db=0)
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
                redis_client = redis.Redis(host='localhost', port=6379, db=0)
                redis_key = f"visitor:{log.person.id}"
                redis_client.setex(redis_key, int(time_remaining_sec), "active")
        except Exception as e:
            pass
            
        return Response({"status": "success", "message": f"Extended by {additional_hours} hour(s)"})
    except VisitorLog.DoesNotExist:
        return Response({"status": "error", "message": "Visitor log not found"}, status=404)
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)

@api_view(['POST'])
def test_camera_stream(request):
    """ Tries to open a camera stream (RTSP/HTTP URL or webcam index) and read one frame, capped by a timeout. """
    import threading
    import cv2
    url = (request.data.get('stream_url') or '').strip()
    if not url:
        return Response({"success": False, "message": "No stream URL provided."})
    result = {"ok": False}
    def _probe():
        cap = None
        try:
            if url.isdigit():
                cap = cv2.VideoCapture(int(url), cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(url)
            if cap.isOpened():
                ret, frame = cap.read()
                result["ok"] = bool(ret and frame is not None)
        except Exception:
            result["ok"] = False
        finally:
            if cap is not None:
                cap.release()
    t = threading.Thread(target=_probe, daemon=True)
    t.start()
    t.join(timeout=8)
    if t.is_alive():
        return Response({"success": False, "message": "Timed out — the stream isn't reachable. Is the source publishing?"})
    if result["ok"]:
        return Response({"success": True, "message": "Connection successful — video is coming through."})
    return Response({"success": False, "message": "Reached the address but couldn't read video from it."})

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
# =================================================
