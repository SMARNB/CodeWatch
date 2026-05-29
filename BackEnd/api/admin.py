from django.contrib import admin
from .models import (
    TrackedPerson, ViolationLog, Camera, IncidentReport,
    Notification, Violation, Feedback, UserProfile, Blacklist, MovementLog, VisitorLog
)

@admin.register(TrackedPerson)
class TrackedPersonAdmin(admin.ModelAdmin):
    list_display = ('name', 'employee_id', 'role', 'department', 'classification', 'created_at')
    list_filter = ('role', 'department', 'classification')
    search_fields = ('name', 'employee_id', 'email')

@admin.register(ViolationLog)
class ViolationLogAdmin(admin.ModelAdmin):
    list_display = ('violation_type', 'person', 'confidence', 'timestamp')
    list_filter = ('violation_type',)

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ('name', 'camera_id', 'location', 'status', 'is_active')
    list_filter = ('status', 'is_active')

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'notif_type', 'is_read', 'timestamp')
    list_filter = ('notif_type', 'is_read')

@admin.register(Blacklist)
class BlacklistAdmin(admin.ModelAdmin):
    list_display = ('person', 'blacklist_type', 'is_active', 'violation_threshold', 'created_at')
    list_filter = ('blacklist_type', 'is_active')

@admin.register(IncidentReport)
class IncidentReportAdmin(admin.ModelAdmin):
    list_display = ('subject', 'report_type', 'priority', 'created_at')
    list_filter = ('report_type', 'priority')

@admin.register(Violation)
class ViolationAdmin(admin.ModelAdmin):
    list_display = ('violation_id', 'type', 'severity', 'status', 'timestamp')
    list_filter = ('severity', 'status')

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('user_type', 'user_id', 'is_request_sent', 'created_at')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')
    list_filter = ('role',)

@admin.register(MovementLog)
class MovementLogAdmin(admin.ModelAdmin):
    list_display = ('person', 'camera_name', 'location_description', 'entered_at', 'exited_at', 'is_violation')
    list_filter = ('is_violation', 'camera_name')
    search_fields = ('person__name', 'camera_name')

@admin.register(VisitorLog)
class VisitorLogAdmin(admin.ModelAdmin):
    list_display = ('person', 'purpose', 'host_name', 'host_department', 'check_in', 'check_out', 'is_active')
    list_filter = ('is_active', 'host_department')
    search_fields = ('person__name', 'host_name')