"""CodeWatch API views — cameras domain (split from the monolithic api/views.py)."""
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
