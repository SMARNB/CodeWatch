"""CodeWatch API views — tracking domain (split from the monolithic api/views.py)."""
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
        redis_client = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
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
            
        redis_client = redis.Redis(host='localhost', port=6379, db=1)
        redis_client.set("track_highlight", str(person_id), ex=3600)
        return Response({"status": "success"})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


@api_view(['POST'])
def live_track_stop(request):
    try:
        redis_client = redis.Redis(host='localhost', port=6379, db=1)
        redis_client.delete("track_highlight")
        return Response({"status": "success"})
    except Exception as e:
        return Response({"status": "error", "message": str(e)}, status=400)


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
