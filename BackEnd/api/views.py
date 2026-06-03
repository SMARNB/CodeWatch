import os
import json
import base64
import io
import cv2
import numpy as np
import redis
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

try:
    face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
except Exception as e:
    print(f"Failed to initialize FaceAnalysis: {e}")
    face_app = None

@csrf_exempt
@api_view(['POST'])
def login_view(request):
    print(f"DEBUG: Login Request Data: {request.data}") # Debug input
    email = request.data.get('email') 
    password = request.data.get('password')

    # Validate Email Format
    try:
        validate_email(email)
    except ValidationError:
        return Response({"message": "Invalid email format"}, status=400)
    
    # 1. Try identifying with email as username
    user = authenticate(username=email, password=password)
    
    # 2. Fallback: If that failed, try finding user by actual email field
    if user is None:
        try:
            user_obj = User.objects.get(email=email)
            if user_obj.check_password(password):
                user = user_obj
        except User.DoesNotExist:
            pass
            
    print(f"DEBUG: Authenticated User: {user}") # Debug result

    if user is not None:
        try:
             # Handle case where user exists but profile might be missing
             role = user.userprofile.role
        except Exception as e:
             print(f"DEBUG: Profile Error: {e}")
             return Response({"message": "User profile not configured"}, status=401)

        return Response({
            "status": "success",
            "userType": role,
            "userName": user.username.split('@')[0] 
        }, status=200)
    
    return Response({"message": "Invalid email or password"}, status=401)

@api_view(['POST'])
def add_member(request):
    """
    Saves a new member from the React Modal.
    """
    try:
        data = request.data
        role = data.get('role')
        login_role = data.get('login_role')
        email = data.get('email')
        employee_id = data.get('employee_id')
        name = data.get('name')
        
        # 1. Create the new TrackedPerson (Use existing logic)
        new_person = TrackedPerson.objects.create(
            name=name,
            employee_id=employee_id,
            email=email,
            role=role or None,
            department=data.get('department'),
            phone=data.get('phone'),
            classification='known'
        )

        # Handle Profile Picture if uploaded
        if 'profile_picture' in request.FILES:
            new_person.profile_picture = request.FILES['profile_picture']
            new_person.save()
            
            # --- FACE EMBEDDING LOGIC ---
            try:
                # Get absolute path of the saved image
                image_path = new_person.profile_picture.path
                img = cv2.imread(image_path)
                
                if face_app is not None and img is not None:
                    faces = face_app.get(img)
                    if faces and len(faces) > 0:
                        # Extract 512-D embedding
                        embedding = faces[0].embedding.tolist()
                        
                        # Save to TrackedPerson (for AI)
                        new_person.embedding_data = json.dumps(embedding)
                        new_person.save()
                    else:
                        raise Exception("Face detection failed")
                else:
                    raise Exception("Face app not initialized or image read failed")

            except Exception as e:
                # Cleanup: Delete the person if face detection fails
                new_person.delete()
                print(f"Face Embedding Error: {e}")
                return Response({"status": "error", "message": "Face detection failed; please provide a clearer image."}, status=400)
            # ---------------------------

        # 2. Check if this role requires a System Login
        SYSTEM_ROLES = ['admin', 'ssd', 'department-head', 'guard']
        
        has_access_flag = data.get('has_software_access', None)
        create_account = str(data.get('has_software_access', 'false')).lower() == 'true' and (login_role in SYSTEM_ROLES)

        if create_account:
            # Create Django User
            # username = email (for consistency with login_view)
            if User.objects.filter(email=email).exists():
                return Response({"status": "error", "message": "A user with this email already exists."}, status=400)
            username = name or email
            if User.objects.filter(username=username).exists():
                username = f"{name} ({employee_id})"
            user = User.objects.create_user(
                username=username,
                email=email,
                password=data.get('password') or 'password123'
            )
            profile = UserProfile.objects.create(user=user, role=login_role, must_change_password=True)
            
            # Copy embedding if it exists (for new requirement)
            if new_person.embedding_data and new_person.embedding_data != "[]":
                profile.face_embedding = new_person.embedding_data
                profile.save()
                
            print(f"✅ System User Created: {username} ({role})")

        return Response({"status": "success", "id": new_person.id})
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
        title = f"Unauthorized Access on {camera.name}" if camera else f"Alert: {v_type}"
        message = f"Person detected at {camera.location if camera else 'Unknown'}. Camera: {camera.camera_id if camera else 'Unknown'}"

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
            "snapshot_url": request.build_absolute_uri(log.snapshot_path.url) if log.snapshot_path else None
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

    # ---- Stat cards (all real) ----
    total_people = TrackedPerson.objects.count()
    total_violations = ViolationLog.objects.count()
    violators = TrackedPerson.objects.filter(violationlog__isnull=False).distinct().count()
    non_violators_stat = total_people - violators

    # ---- Pie: tracked people by category (mutually exclusive) ----
    blacklisted = TrackedPerson.objects.filter(classification__iexact='blacklisted').count()
    visitors = TrackedPerson.objects.filter(classification__iexact='visitor').count()
    unauthorized = TrackedPerson.objects.filter(classification__iexact='unknown').count()
    remaining = TrackedPerson.objects.exclude(
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
    for r in (ViolationLog.objects
              .annotate(b=TruncMonth('timestamp'))
              .values('b')
              .annotate(count=Count('id'))):
        if r['b']:
            month_map[(r['b'].year, r['b'].month)] = r['count']
    line_labels = [calendar.month_abbr[m] for (y, m) in seq]
    line_data = [month_map.get((y, m), 0) for (y, m) in seq]

    # ---- Trend: violations by TYPE per month (last 6 months) ----
    vtype_rows = (ViolationLog.objects
                  .values('violation_type')
                  .annotate(c=Count('id'))
                  .order_by('-c'))
    vtype_labels = [(r['violation_type'] or 'Unknown') for r in vtype_rows]
    six = seq[-6:]
    trend_labels = [calendar.month_abbr[m] for (y, m) in six]
    by_type = defaultdict(dict)
    for r in (ViolationLog.objects
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
    for r in (ViolationLog.objects
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
            "nonViolators": {"value": non_violators_stat},
            "unauthorized": {"value": total_violations},
            "violators": {"value": violators},
            "victors": {"value": total_people},
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

@api_view(['GET'])
def get_people_db(request):
    """ Returns the raw list of people stored in the Database. """
    people = TrackedPerson.objects.all().order_by('-id') # Newest first
    data = []
    for p in people:
        status_text = "No Embedding"
        if p.embedding_data and p.embedding_data != "[]":
            try:
                data_list = json.loads(p.embedding_data)
                if isinstance(data_list, list) and len(data_list) == 512:
                    status_text = "Encoded (512-D)"
            except:
                pass
                
        violation_count = ViolationLog.objects.filter(person=p).count()
        photo_url = request.build_absolute_uri(p.profile_picture.url) if p.profile_picture else None

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
            "status": status_text
        })
    return Response(data)

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
def get_cameras(request):
    """ Returns list of cameras for the database page. """
    cameras = Camera.objects.all().order_by('-created_at')
    data = list(cameras.values())
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

@api_view(['GET'])
def get_users(request):
    """ Returns all users for the user management page. """
    profiles = UserProfile.objects.select_related('user').all()
    data = []
    for p in profiles:
        data.append({
            "id": p.user.id,
            "username": p.user.username,
            "email": p.user.email,
            "role": p.role,
            "is_active": p.user.is_active,
            "last_login": p.user.last_login
        })
    return Response(data)

@api_view(['PATCH', 'DELETE'])
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

    # 2. Apply Filters
    # Filter by Department
    if filters.get('department') and len(filters['department']) > 0:
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
        "timelineData": timeline,
    })

@api_view(['POST'])
def send_report(request):
    """
    Saves an incident report from the Modal.
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
                
                # Fetch snapshots
                violations = ViolationLog.objects.filter(person_id=person_id).exclude(snapshot='')
                snapshots = []
                for v in violations:
                    if v.snapshot:
                        snapshots.append(request.build_absolute_uri(v.snapshot.url))
                        
                # Update analytics_json with the new data
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

        report = IncidentReport.objects.create(
            report_type=data.get('reportType'),
            recipients=data.get('recipients'),
            subject=data.get('subject'),
            priority=data.get('priority'),
            message=data.get('message'),
            related_person_id=person_id if person_id else None,
            analytics_json=analytics_str
        )
        return Response({"status": "success", "report_id": report.id})
    except Exception as e:
        print(f"Report Error: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)
    
    
@api_view(['GET'])
def get_reports(request):
    """ Returns all incident reports from the database. """
    import json
    reports = IncidentReport.objects.all().order_by('-created_at')
    data = []
    for r in reports:
        snapshot_url = None
        movement_summary = []
        try:
            if r.analytics_json:
                analytics_data = json.loads(r.analytics_json)
                if 'snapshots' in analytics_data and len(analytics_data['snapshots']) > 0:
                    snapshot_url = analytics_data['snapshots'][0]
                if 'movement_summary' in analytics_data:
                    movement_summary = analytics_data['movement_summary']
        except Exception:
            pass

        data.append({
            "id": r.id,
            "custom_id": f"RPT-{r.id:04d}",
            "description": r.subject,
            "date": r.created_at,
            "type": r.report_type,
            "status": "Logged",
            "priority": r.priority,
            "message": r.message,
            "analytics_json": r.analytics_json,
            "snapshot_url": snapshot_url,
            "movement_summary": movement_summary
        })
    return Response(data)

@api_view(['GET'])
def get_report_detail(request, report_id):
    """ Returns full details of a specific incident report """
    import json
    try:
        report = IncidentReport.objects.get(id=report_id)
        analytics_data = None
        try:
            if report.analytics_json:
                analytics_data = json.loads(report.analytics_json)
        except Exception:
            pass

        return Response({
            "id": report.id,
            "custom_id": f"RPT-{report.id:04d}",
            "description": report.subject,
            "date": report.created_at,
            "type": report.report_type,
            "status": "Logged",
            "priority": report.priority,
            "message": report.message,
            "recipients": report.recipients,
            "analytics_json": report.analytics_json,
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
    from django.db.models import Q
    from .models import NotificationState
    user_key = (request.GET.get('user') or '').strip()
    role = (request.GET.get('role') or '').strip().lower()

    qs = Notification.objects.all().order_by('-timestamp')
    qs = qs.filter(Q(target_role__isnull=True) | Q(target_role='') | Q(target_role__iexact=role))

    cleared_ids, read_ids = set(), set()
    if user_key:
        cleared_ids = set(NotificationState.objects.filter(user_key=user_key, is_cleared=True).values_list('notification_id', flat=True))
        read_ids = set(NotificationState.objects.filter(user_key=user_key, is_read=True).values_list('notification_id', flat=True))

    data = []
    for n in qs:
        if n.id in cleared_ids:
            continue
        vid = n.violation_log.id if n.violation_log else None
        message = f"{n.message} · Violation #{vid}" if vid else n.message
        data.append({
            "id": n.id,
            "title": n.title,
            "message": message,
            "type": n.notif_type,
            "is_read": (n.id in read_ids),
            "time": n.timestamp.strftime("%b %d, %I:%M %p"),
            "person_id": n.person.id if n.person else None,
            "camera_id": n.camera.camera_id if n.camera else None,
            "violation_id": vid
        })
    return Response(data)

@api_view(['POST'])
def mark_notif_read(request, notif_id):
    """ Marks one notification read for THIS user only. """
    from .models import NotificationState
    user_key = (request.query_params.get('user') or request.data.get('user') or '').strip()
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
    user_key = (request.query_params.get('user') or request.data.get('user') or '').strip()
    role = (request.query_params.get('role') or request.data.get('role') or '').strip().lower()
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
    user_key = (request.query_params.get('user') or request.data.get('user') or '').strip()
    role = (request.query_params.get('role') or request.data.get('role') or '').strip().lower()
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
def forgot_password(request):
    """ A user requests a reset. We don't reset here — we notify the admin (admin-only
        notification), who resets it to the default from Manage Users. """
    email = (request.data.get('email') or '').strip()
    if not email:
        return Response({"status": "error", "message": "Please enter your email."}, status=400)
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({"status": "error", "message": "No account found with that email."}, status=404)
    Notification.objects.create(
        title="Password Reset Requested",
        message=f"{email} requested a password reset. Reset it to the default from Manage Users.",
        notif_type='system',
        target_role='admin'
    )
    return Response({"status": "success", "message": "Request sent to the administrator."})


@api_view(['POST'])
def reset_user_password(request, user_id):
    """ Admin resets a user's password to the default AND flags the account so the
        user must set their own password on next login. """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"status": "error", "message": "User not found"}, status=404)
    user.set_password('password123')
    user.save()
    profile = getattr(user, 'userprofile', None)
    if profile:
        profile.must_change_password = True
        profile.save()
    return Response({"status": "success", "message": f"Password for {user.username} reset to password123. They'll be asked to set a new one on next login."})


@api_view(['GET'])
def password_status(request):
    """ Tells the login page whether this account must change its password first. """
    email = (request.GET.get('email') or '').strip()
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        return Response({"must_change_password": False})
    profile = getattr(user, 'userprofile', None)
    return Response({"must_change_password": bool(profile and profile.must_change_password)})


@api_view(['POST'])
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
                "profile_picture": request.build_absolute_uri(notif.person.profile_picture.url) if notif.person.profile_picture else None
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
                "snapshot_url": request.build_absolute_uri(notif.violation_log.snapshot_path.url) if bool(notif.violation_log.snapshot_path) else None
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
    "http://127.0.0.1:8000/media/2.mp4",
    "http://127.0.0.1:8000/media/2.mp4",
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
            
        profile_url = request.build_absolute_uri(person.profile_picture.url) if person.profile_picture else None

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
            snapshot_url = request.build_absolute_uri(v.snapshot_path.url) if v.snapshot_path else None
            
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
    """ Posts violation feedback as an Incident Report (shows up in Previous Reports),
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
            snapshot_url = request.build_absolute_uri(snap_log.snapshot_path.url)
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
    if classification not in ['known', 'unknown', 'blacklisted', 'visitor']:
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
        
    people = TrackedPerson.objects.filter(
        Q(name__icontains=query) | 
        Q(employee_id__icontains=query) | 
        Q(email__icontains=query)
    )
    
    cameras = Camera.objects.filter(
        Q(name__icontains=query) | 
        Q(camera_id__icontains=query) | 
        Q(location__icontains=query)
    )
    
    violations = ViolationLog.objects.filter(
        Q(violation_type__icontains=query)
    )
    
    redis_client = redis.Redis(host='localhost', port=6379, db=0)
    
    people_data = []
    for p in people:
        violation_count = ViolationLog.objects.filter(person=p).count()
        
        is_live = False
        current_camera = None
        redis_key = f"global_identity:{p.id}"
        redis_data = redis_client.get(redis_key)
        
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
    try:
        data = request.data
        name = data.get('name')
        phone = data.get('phone')
        purpose = data.get('purpose')
        host_name = data.get('host_name')
        host_department = data.get('host_department')
        expected_duration_hours = int(data.get('expected_duration_hours', 2))
        
        # Auto-generate employee_id and email
        timestamp_str = timezone.now().strftime("%Y%m%d%H%M%S")
        unique_id = f"VIS-{timestamp_str}"
        email = f"{unique_id}@codewatch.com"
        
        # Create TrackedPerson
        new_person = TrackedPerson.objects.create(
            name=name,
            employee_id=unique_id,
            email=email,
            role='visitor',
            classification='visitor',
            phone=phone
        )
        
        # Handle Profile Picture if uploaded
        if 'profile_picture' in request.FILES:
            new_person.profile_picture = request.FILES['profile_picture']
            new_person.save()
            
            try:
                image_path = new_person.profile_picture.path
                img = cv2.imread(image_path)
                
                if face_app is not None and img is not None:
                    faces = face_app.get(img)
                    if faces and len(faces) > 0:
                        embedding = faces[0].embedding.tolist()
                        new_person.embedding_data = json.dumps(embedding)
                        new_person.save()
            except Exception as e:
                print(f"Face Embedding Error for visitor: {e}")

        # Create VisitorLog
        visitor_log = VisitorLog.objects.create(
            person=new_person,
            purpose=purpose,
            host_name=host_name,
            host_department=host_department,
            expected_duration_hours=expected_duration_hours
        )
        
        # Write to Redis
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
            src = int(url) if url.isdigit() else url
            cap = cv2.VideoCapture(src)
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
