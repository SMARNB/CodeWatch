from django.db import models
import json

class TrackedPerson(models.Model):
    # Basic Info
    name = models.CharField(max_length=100)
    employee_id = models.CharField(max_length=50, unique=True, default="EMP000")
    email = models.EmailField(default="unknown@company.com")
    role = models.CharField(max_length=50, default="Employee")
    department = models.CharField(max_length=100, default="General")
    phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Images
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    
    # AI Data (Hidden from UI, used by Python Script)
    embedding_data = models.TextField(default="[]", blank=True) 
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class ViolationLog(models.Model):
    person = models.ForeignKey(TrackedPerson, on_delete=models.CASCADE, null=True)
    violation_type = models.CharField(max_length=100)
    confidence = models.FloatField(default=0.0)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.violation_type} - {self.timestamp}"
    
class Camera(models.Model):
    name = models.CharField(max_length=100)
    camera_id = models.CharField(max_length=50, unique=True)
    location = models.CharField(max_length=100)
    ip_address = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, default="Offline") # Active, Maintenance, Offline
    stream_url = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.camera_id})"

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
    is_read = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)

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
    user_type = models.CharField(max_length=50)
    user_id = models.CharField(max_length=50)
    thoughts = models.TextField()
    is_request_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=[
        ('admin', 'Admin'),
        ('ssd', 'SSD'),
        ('department-head', 'Department Head')
    ])
    face_embedding = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.role}"