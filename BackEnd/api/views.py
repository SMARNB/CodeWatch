from django.contrib.auth import authenticate
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count
from .models import TrackedPerson, ViolationLog, Camera, IncidentReport, Notification, Violation
from django.contrib.auth.models import User
import json
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils.dateparse import parse_date
from django.utils.dateparse import parse_date
from django.utils import timezone
from deepface import DeepFace
import os

from django.core.validators import validate_email
from django.core.exceptions import ValidationError

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
             role = 'admin'

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
                
                # Generate embedding (using Facenet for speed/accuracy balance)
                embedding_objs = DeepFace.represent(img_path=image_path, model_name="Facenet", enforce_detection=True)
                
                if embedding_objs and len(embedding_objs) > 0:
                    embedding = embedding_objs[0]["embedding"]
                    
                    # Save to TrackedPerson (for AI)
                    new_person.embedding_data = json.dumps(embedding)
                    new_person.save()
                else:
                    raise Exception("Face detection failed")

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
                "embedding": json.loads(p.embedding_data)
            }
        except:
            continue
    return Response(data)

@api_view(['POST'])
def log_violation(request):
    """ Receives alerts from the AI script. """
    person_id = request.data.get('person_id')
    v_type = request.data.get('type')
    conf = request.data.get('conf')
    
    if person_id:
        try:
            p = TrackedPerson.objects.get(id=person_id)
            # 1. Create Log
            ViolationLog.objects.create(person=p, violation_type=v_type, confidence=conf or 0.0)
            
            # 2. Link to Notification System (Added by Audit)
            title = f"Alert: {v_type}"
            message = f"{v_type} detected for {p.name}."
            
            # Determine type
            notif_type = 'security'
            if 'Dress' in v_type: notif_type = 'system'
            
            Notification.objects.create(
                title=title,
                message=message,
                notif_type=notif_type
            )
        except Exception as e:
            print(f"Error logging violation: {e}")
            pass
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
        })
    return Response(data)

@api_view(['GET'])
def get_dashboard_stats(request):
    """ Calculates numbers for Cards and Pie Chart. """
    total_people = TrackedPerson.objects.count()
    total_violations = ViolationLog.objects.count()
    violators = TrackedPerson.objects.filter(violationlog__isnull=False).distinct().count()
    
    # Pie Chart
    v_types = ViolationLog.objects.values('violation_type').annotate(count=Count('id'))
    pie_labels = [v['violation_type'] for v in v_types] if v_types else ["No Data"]
    pie_data = [v['count'] for v in v_types] if v_types else [1]

    return Response({
        "stats": {
            "nonViolators": { "value": total_people - violators },
            "violators": { "value": violators },
            "unauthorized": { "value": total_violations },
            "victors": { "value": total_people }
        },
        "pie_chart": { "labels": pie_labels, "data": pie_data }
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
        data.append({
            "id": p.id,
            "name": p.name,
            "created_at": p.created_at,
            # Show if we have their face data saved
            "status": "Encoded (1024-D)" if p.embedding_data else "No Data" 
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
        # Map frontend "Students" to backend "student" if needed
        roles = [r.lower().replace('s', '') for r in filters['userType']] # simple cleaner
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
        report = IncidentReport.objects.create(
            report_type=data.get('reportType'),
            recipients=data.get('recipients'),
            subject=data.get('subject'),
            priority=data.get('priority'),
            message=data.get('message'),
            related_person_id=data.get('personId') if data.get('personId') else None,
            analytics_json=data.get('analytics_json') # <--- ADD THIS LINE
        )
        return Response({"status": "success", "report_id": report.id})
    except Exception as e:
        print(f"Report Error: {e}")
        return Response({"status": "error", "message": str(e)}, status=400)
    
    
@api_view(['GET'])
def get_reports(request):
    """ Returns all incident reports from the database. """
    reports = IncidentReport.objects.all().order_by('-created_at')
    data = []
    for r in reports:
        data.append({
            "id": r.id,
            "custom_id": f"RPT-{r.id:04d}",
            "description": r.subject,
            "date": r.created_at,
            "type": r.report_type,
            "status": "Logged",
            "priority": r.priority,
            "message": r.message,
            "analytics_json": r.analytics_json # <--- ADD THIS LINE
    })
    return Response(data)

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
            "time": n.timestamp.strftime("%b %d, %I:%M %p") # Format: Jan 22, 08:47 PM
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
    """ Returns a single notification with mocked violation events. """
    try:
        notif = Notification.objects.get(pk=pk)
        
        # Mocking related violations (fetching recent logs as demo)
        # In a real scenario, this would filter by related_id or timestamp
        recent_logs = ViolationLog.objects.all().order_by('-timestamp')[:3]
        
        events = []
        # Get a default camera for location
        default_cam = Camera.objects.first()
        location = default_cam.location if default_cam else "Unknown Location"
        cam_id = default_cam.camera_id if default_cam else "CAM-001"
        
        for log in recent_logs:
             events.append({
                 "id": log.id,
                 "type": log.violation_type, 
                 "title": f"Violation: {log.violation_type}",
                 "description": f"Detected {log.violation_type} with {log.confidence*100:.1f}% confidence",
                 "timestamp": log.timestamp,
                 "location": location, 
                 "cameraId": cam_id, 
                 "clipUrl": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" 
             })
             
        # Try to find a related person from the recent logs
        person_id = recent_logs[0].person.id if recent_logs and recent_logs[0].person else 1

        data = {
            "id": notif.id,
            "title": notif.title,
            "message": notif.message,
            "type": notif.notif_type,
            "is_read": notif.is_read,
            "timestamp": notif.timestamp,
            "violation_events": events,
            "personId": person_id # Exposed for frontend live tracking
        }
        return Response(data)
    except Notification.DoesNotExist:
        return Response(status=404)

@api_view(['POST'])
def submit_feedback(request):
    """ Receives feedback from the frontend. """
    # In a future iteration, save this to a Feedback model
    print(f"Feedback Received: {request.data}")
    return Response({"status": "success", "message": "Feedback submitted successfully"})

@api_view(['GET'])
def get_violation_events(request, pk):
    """ Returns violation events for a specific notification. """
    try:
        # In a real app, we'd filter ViolationLog by this notification
        # For now, we'll return recent logs as mock data for this notification logic
        recent_logs = ViolationLog.objects.all().order_by('-timestamp')[:5]
        
        events = []
        default_cam = Camera.objects.first()
        location = default_cam.location if default_cam else "Unknown Location"
        cam_id = default_cam.camera_id if default_cam else "CAM-001"
        
        for log in recent_logs:
             events.append({
                 "id": log.id,
                 "type": log.violation_type, 
                 "title": f"Violation: {log.violation_type}",
                 "description": f"Detected {log.violation_type} with {log.confidence*100:.1f}% confidence",
                 "timestamp": log.timestamp,
                 "location": location, 
                 "cameraId": cam_id, 
                 "clipUrl": "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" 
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
    Queries the most recent violation to find where they were last seen.
    """
    current_time_index = (int(timezone.now().timestamp()) // 10) % len(RECORDED_CLIPS)
    
    return Response({
        "active_camera_name": f"Camera CAM-00{current_time_index + 1}",
        "location": "Building A - Floor 3",
        "stream_url": RECORDED_CLIPS[current_time_index], 
        "is_live": True
    })
    try:
        # 1. Find the most recent violation for this person
        latest_log = ViolationLog.objects.filter(person_id=person_id).order_by('-timestamp').first()
        
        # 2. Find an active camera 
        # Note: In a real system, ViolationLog should link to a Camera. 
        # Here we'll use the first active camera or fallback to any camera.
        camera = Camera.objects.filter(status='Active').first() or Camera.objects.first()
        
        if not camera:
            return Response({"status": "error", "message": "No active cameras found"}, status=404)

        return Response({
            "active_camera_name": camera.name,
            "stream_url": camera.stream_url,
            "location": camera.location,
            "last_seen": latest_log.timestamp if latest_log else None,
            "violation_type": latest_log.violation_type if latest_log else "None"
        })
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


@api_view(['GET', 'DELETE'])
def manage_violations(request, pk=None):
    if request.method == 'GET':
        violations = Violation.objects.all().order_by('-timestamp')
        return Response([{"id": v.id, "violation_id": v.violation_id, "type": v.type, "location": v.location, 
                          "severity": v.severity, "status": v.status, "time": v.timestamp.strftime("%b %d, %Y, %I:%M %p")} 
                         for v in violations])
    
    if request.method == 'DELETE':
        Violation.objects.get(id=pk).delete()
        return Response(status=204)

@api_view(['POST'])
def submit_feedback(request):
    data = request.data
    Feedback.objects.create(
        user_type=data.get('userType'),
        user_id=data.get('userId'),
        thoughts=data.get('thoughts'),
        is_request_sent=data.get('sendRequest', False)
    )
    return Response({"status": "success"})


from django.contrib.auth import authenticate
from .models import UserProfile

