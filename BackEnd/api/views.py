import os
import json
import base64
import io
import cv2
import numpy as np
import redis
import time

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
        email = data.get('email')
        employee_id = data.get('employee_id')
        name = data.get('name')
        
        # 1. Create the new TrackedPerson (Use existing logic)
        new_person = TrackedPerson.objects.create(
            name=name,
            employee_id=employee_id,
            email=email,
            role=role,
            department=data.get('department'),
            phone=data.get('phone')
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
        SYSTEM_ROLES = ['admin', 'ssd', 'department-head']
        if role in SYSTEM_ROLES:
            # Create Django User
            # Create Django User
            # username = email (for consistency with login_view)
            username = email
            
            # Ensure unique username (although email should be unique)
            if User.objects.filter(username=username).exists():
                 return Response({"status": "error", "message": "User with this email already exists."}, status=400)
            
            # Create User
            user = User.objects.create_user(
                username=username,
                email=email,
                password=data.get('password', 'password123') # Use provided password or default
            )
            
            # Create UserProfile
            profile = UserProfile.objects.create(user=user, role=role)
            
            # Copy embedding if it exists (for new requirement)
            if new_person.embedding_data and new_person.embedding_data != "[]":
                profile.face_embedding = new_person.embedding_data
                profile.save()
                
            print(f"✅ System User Created: {username} ({role})")

        return Response({"status": "success", "id": new_person.id})
    except Exception as e:
        print(f"Error adding member: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)
# --- 1. AI SYSTEM ENDPOINTS ---

@api_view(['GET'])
def get_all_embeddings(request):
    """ Sends known faces to the AI script. """
    persons = TrackedPerson.objects.all()
    data = {}
    for p in persons:
        try:
            data[p.id] = {
                "name": p.name, 
                "embedding": json.loads(p.embedding_data),
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

@api_view(['POST'])
def log_violation(request):
    """ Receives alerts from the AI script. """
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
        
        # Determine type
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
    """ Calculates numbers for Cards and Pie Chart. """
    total_people = TrackedPerson.objects.count()
    total_violations = ViolationLog.objects.count()
    violators = TrackedPerson.objects.filter(violationlog__isnull=False).distinct().count()
    
    non_violators = total_people - violators
    visitors = TrackedPerson.objects.filter(classification='visitor').count()
    unauthorized = ViolationLog.objects.filter(violation_type__icontains='Unauthorized').count()
    dresscode = ViolationLog.objects.filter(violation_type__icontains='Dress Code').count()
    
    total_sum = non_violators + unauthorized + visitors + violators + dresscode

    return Response({
        "stats": {
            "nonViolators": { "value": non_violators },
            "violators": { "value": violators },
            "unauthorized": { "value": total_violations },
            "victors": { "value": total_people }
        },
        "pie_chart": {
            "labels": ["Non-Violators", "Unauthorized", "Visitors", "Violators", "Dress Code Violations"],
            "data": [non_violators, unauthorized, visitors, violators, dresscode]
        },
        "non_violators": non_violators,
        "unauthorized": unauthorized,
        "visitors": visitors, 
        "violators": violators,
        "dresscode": dresscode,
        "total": total_sum
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

@api_view(['PATCH'])
def update_user_role(request, user_id):
    """ Updates a user's role or status. """
    try:
        user = User.objects.get(id=user_id)
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

    # Filter by User Type (Role)
    if filters.get('userType') and len(filters['userType']) > 0:
        role_mapping = {
            'Students': 'student',
            'Employees': 'employee',
            'Visitors': 'visitor',
            'Contractors': 'contractor',
            'Faculty': 'faculty'
        }
        roles = [role_mapping.get(r, r.lower()) for r in filters['userType']]
        people = people.filter(role__in=roles) 
        logs = logs.filter(person__role__in=roles)

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

    return Response({
        "nonViolators": non_violators,
        "violators": violators_count,
        "unauthorized": unauthorized,
        "visitors": visitors,
        "victors": victors
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
    """ Returns all notifications, latest first. """
    notifications = Notification.objects.all().order_by('-timestamp')
    data = []
    for n in notifications:
        data.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.notif_type,
            "is_read": n.is_read,
            "time": n.timestamp.strftime("%b %d, %I:%M %p"), # Format: Jan 22, 08:47 PM
            "person_id": n.person.id if n.person else None,
            "camera_id": n.camera.camera_id if n.camera else None
        })
    return Response(data)

@api_view(['POST'])
def mark_notif_read(request, notif_id):
    """ Marks a specific notification as read. """
    try:
        notif = Notification.objects.get(id=notif_id)
        notif.is_read = True
        notif.save()
        return Response({"status": "success"})
    except Notification.DoesNotExist:
        return Response({"status": "error"}, status=404)

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
    data = request.data
    feedback = Feedback.objects.create(
        user_type=data.get('userType'),
        user_id=data.get('userId'),
        thoughts=data.get('thoughts'),
        is_request_sent=data.get('sendRequest', False)
    )
    violation_id = data.get('violation_id')
    if violation_id:
        try:
            violation = Violation.objects.get(id=violation_id)
            feedback.violation = violation
            feedback.save()
        except Violation.DoesNotExist:
            pass
    return Response({"status": "success"})


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
