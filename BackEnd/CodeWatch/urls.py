from django.contrib import admin
from django.urls import path
from api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/get-embeddings/', views.get_all_embeddings),
    path('api/log-violation/', views.log_violation),
    path('api/activity/', views.get_recent_activity), 
    path('api/stats/', views.get_violation_stats),  
    path('api/people-db/', views.get_people_db),
    path('api/dashboard-stats/', views.get_dashboard_stats),
    path('api/add-member/', views.add_member),
    path('api/add-camera/', views.add_camera),
    path('api/cameras/', views.get_cameras),
    path('api/get-analytics/', views.get_analytics_data),
    path('api/send-report/', views.send_report),
    path('api/get-reports/', views.get_reports),
    path('api/delete-report/<int:report_id>/', views.delete_report),
    path('api/notifications/', views.get_notifications),
    path('api/notifications/read/<int:notif_id>/', views.mark_notif_read),
    path('api/notifications/<int:pk>/', views.get_notification_detail),
    path('api/notifications/<int:pk>/violation-events/', views.get_violation_events),
    path('api/live-track/<int:person_id>/', views.get_live_tracking_feed),
    path('api/feedback/', views.submit_feedback),
    path('api/violations/', views.manage_violations),
    path('api/violations/<int:pk>/', views.manage_violations),
    path('api/login/', views.login_view),
]