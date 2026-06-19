"""CodeWatch API views — auth domain (split from the monolithic api/views.py)."""
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
