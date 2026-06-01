from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
import json
import numpy as np

class TrackedPerson(models.Model):
    # Basic Info
    name = models.CharField(max_length=100)
    employee_id = models.CharField(max_length=50, unique=True, default="EMP000")
    email = models.EmailField(default="unknown@company.com")
    role = models.CharField(max_length=50, default="Employee")
    department = models.CharField(max_length=100, default="General")
    phone = models.CharField(max_length=20, blank=True, null=True)
    classification = models.CharField(max_length=20, choices=[('known','Known'),('unknown','Unknown'),('blacklisted','Blacklisted')], default='unknown')
    gender = models.CharField(max_length=10, choices=[('male','Male'),('female','Female')], default='male')
    semester = models.CharField(max_length=20, blank=True, null=True)
    
    # Images
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    snapshot_image = models.ImageField(upload_to='snapshots/', blank=True, null=True)
    
    # AI Data (Hidden from UI, used by Python Script)
    face_embedding = models.TextField(default="[]", blank=True)
    embedding_data = models.TextField(default="[]", blank=True) 
    created_at = models.DateTimeField(auto_now_add=True)

    def get_embedding_vector(self):
        try:
            return np.array(json.loads(self.face_embedding), dtype=np.float32)
        except (ValueError, TypeError, json.JSONDecodeError):
            return np.array([], dtype=np.float32)

    def __str__(self):
        return self.name

class Blacklist(models.Model):
    person = models.ForeignKey(TrackedPerson, on_delete=models.CASCADE, related_name='blacklist_entries')
    reason = models.TextField()
    blacklist_type = models.CharField(max_length=10, choices=[('auto','Automatic'),('manual','Manual')], default='auto')
    added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    violation_threshold = models.IntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Blacklist: {self.person.name} ({self.blacklist_type})"

class ViolationLog(models.Model):
    person = models.ForeignKey(TrackedPerson, on_delete=models.CASCADE, null=True)
    camera = models.ForeignKey('Camera', on_delete=models.SET_NULL, null=True, blank=True)
    violation_type = models.CharField(max_length=100)
    confidence = models.FloatField(default=0.0)
    snapshot_path = models.ImageField(upload_to='violations/%Y/%m/%d/', blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.violation_type} - {self.timestamp}"
    
class Camera(models.Model):
    name = models.CharField(max_length=100)
    camera_id = models.CharField(max_length=50, unique=True)
    location = models.CharField(max_length=100)
    ip_address = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default="Offline") # Active, Maintenance, Offline
    is_active = models.BooleanField(default=True)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    stream_url = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.camera_id})"

class MovementLog(models.Model):
    person = models.ForeignKey(TrackedPerson, on_delete=models.CASCADE, related_name='movements')
    camera = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True)
    camera_name = models.CharField(max_length=100)
    location_description = models.CharField(max_length=200)
    entered_at = models.DateTimeField(auto_now_add=True)
    exited_at = models.DateTimeField(null=True, blank=True)
    is_violation = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-entered_at']

class IncidentReport(models.Model):
    # Form Fields
    report_type = models.CharField(max_length=50)
    recipients = models.TextField() # Comma-separated emails
    subject = models.CharField(max_length=200)
    priority = models.CharField(max_length=20) # High, Medium, Low
    message = models.TextField()
    analytics_json = models.TextField(blank=True, null=True)
    
    # Auto-Linked Data (Optional, can be null if generic report)
    related_person = models.ForeignKey(TrackedPerson, on_delete=models.SET_NULL, null=True, blank=True)
    violation_log = models.ForeignKey(ViolationLog, on_delete=models.SET_NULL, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.subject} ({self.priority})"
    
class Notification(models.Model):
    # Notification Types: security, system, account, backup
    NOTIFICATION_TYPES = [
        ('security', 'Security Violation'),
        ('system', 'System Maintenance'),
        ('account', 'Account Update'),
        ('backup', 'System Backup'),
    ]

    title = models.CharField(max_length=200)
    message = models.TextField()
    notif_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='system')
    target_role = models.CharField(max_length=50, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

    person = models.ForeignKey(TrackedPerson, on_delete=models.SET_NULL, null=True, blank=True)
    camera = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True, blank=True)
    violation_log = models.ForeignKey('ViolationLog', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.title} - {self.timestamp.strftime('%Y-%m-%d %H:%M')}"

class Violation(models.Model):
    VIOLATION_ID_PREFIX = "VIOL-00"
    SEVERITY_CHOICES = [('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')]
    STATUS_CHOICES = [('Pending', 'Pending'), ('Under Review', 'Under Review'), ('Resolved', 'Resolved')]

    violation_id = models.CharField(max_length=20, unique=True)
    type = models.CharField(max_length=100)
    location = models.CharField(max_length=100)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.violation_id

class Feedback(models.Model):
    violation = models.ForeignKey(Violation, on_delete=models.CASCADE, null=True, blank=True)
    violation_log = models.ForeignKey('ViolationLog', on_delete=models.SET_NULL, null=True, blank=True, related_name='feedbacks')
    user_type = models.CharField(max_length=50)
    user_id = models.CharField(max_length=50)
    thoughts = models.TextField()
    is_request_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

def validate_embedding_length(value):
    try:
        data = json.loads(value)
        if not isinstance(data, list) or len(data) != 512:
            raise ValidationError("Face embedding must be a JSON list of exactly 512 elements.")
    except (ValueError, TypeError, json.JSONDecodeError):
        raise ValidationError("Invalid JSON format for face embedding.")

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=[
        ('admin', 'Admin'),
        ('ssd', 'SSD'),
        ('department-head', 'Department Head'),
        ('guard', 'Guard')
    ])
    face_embedding = models.TextField(blank=True, null=True, validators=[validate_embedding_length])
    must_change_password = models.BooleanField(default=False)

    def get_embedding_as_vector(self):
        if not self.face_embedding:
            return np.array([], dtype=np.float32)
        try:
            return np.array(json.loads(self.face_embedding), dtype=np.float32)
        except (ValueError, TypeError, json.JSONDecodeError):
            return np.array([], dtype=np.float32)

        return f"{self.user.username} - {self.role}"

from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=ViolationLog)
def check_auto_blacklist(sender, instance, created, **kwargs):
    if created and instance.person:
        person = instance.person
        if person.classification == 'blacklisted':
            return
            
        violation_count = ViolationLog.objects.filter(person=person).count()
        threshold = 10
        if violation_count >= threshold:
            Blacklist.objects.create(
                person=person,
                reason=f"Automatically blacklisted due to reaching {threshold} violations.",
                blacklist_type='auto',
                violation_threshold=threshold
            )
            person.classification = 'blacklisted'
            person.save()
            
            Notification.objects.create(
                title=f"Auto-Blacklist: {person.name}",
                message=f"{person.name} has been automatically blacklisted after {violation_count} violations.",
                notif_type='security'
            )

class VisitorLog(models.Model):
    person = models.ForeignKey(TrackedPerson, on_delete=models.CASCADE, related_name='visitor_logs')
    purpose = models.CharField(max_length=200)
    host_name = models.CharField(max_length=100)
    host_department = models.CharField(max_length=100)
    check_in = models.DateTimeField(auto_now_add=True)
    check_out = models.DateTimeField(null=True, blank=True)
    expected_duration_hours = models.IntegerField(default=2)
    checked_out_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-check_in']

    def __str__(self):
        return f"Visit: {self.person.name} to {self.host_name}"

class NotificationState(models.Model):
    """ Per-user read/cleared state for a notification, so 'viewed' and 'cleared'
        are isolated per user instead of global. user_key is the user's email. """
    user_key = models.CharField(max_length=255)
    notification = models.ForeignKey('Notification', on_delete=models.CASCADE, related_name='user_states')
    is_read = models.BooleanField(default=False)
    is_cleared = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user_key', 'notification')