from django.contrib import admin
from django.urls import path
from api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/admin/', admin.site.urls),
    path('api/register-unknown/', views.register_unknown),
    path('api/get-embeddings/', views.get_all_embeddings),
    path('api/log-violation/', views.log_violation),
    path('api/activity/', views.get_recent_activity), 
    path('api/stats/', views.get_violation_stats),  
    path('api/people-db/', views.get_people_db),
    path('api/dashboard-stats/', views.get_dashboard_stats),
    path('api/add-member/', views.add_member),
    path('api/add-camera/', views.add_camera),
    path('api/cameras/', views.get_cameras),
    path('api/cameras/<str:camera_id>/', views.manage_camera_detail),
    path('api/users/', views.get_users),
    path('api/users/<int:user_id>/', views.update_user_role),
    path('api/get-analytics/', views.get_analytics_data),
    path('api/send-report/', views.send_report),
    path('api/get-reports/', views.get_reports),
    path('api/reports/<int:report_id>/', views.get_report_detail),
    path('api/delete-report/<int:report_id>/', views.delete_report),
    path('api/notifications/', views.get_notifications),
    path('api/notifications/read/<int:notif_id>/', views.mark_notif_read),
    path('api/notifications/<int:pk>/', views.get_notification_detail),
    path('api/notifications/<int:pk>/violation-events/', views.get_violation_events),
    path('api/live-track/<int:person_id>/', views.get_live_tracking_feed),
    path('api/feedback/', views.submit_feedback),
    path('api/violations/', views.manage_violations),
    path('api/violations/<int:pk>/', views.manage_violations),
    path('api/blacklist/', views.manage_blacklist),
    path('api/blacklist/<int:pk>/', views.manage_blacklist),
    path('api/login/', views.login_view),
    path('api/movement-log/', views.log_movement),
    path('api/movement-history/<int:person_id>/', views.get_movement_history),
    path('api/live-track/start/', views.live_track_start),
    path('api/live-track/stop/', views.live_track_stop),
    path('api/search/', views.search_all),
    path('api/visitors/add/', views.add_visitor),
    path('api/visitors/active/', views.get_active_visitors),
    path('api/visitors/', views.get_all_visitors),
    path('api/visitors/checkout/<int:visitor_log_id>/', views.checkout_visitor),
    path('api/visitors/extend/<int:visitor_log_id>/', views.extend_visitor),
]

from django.conf import settings
from django.conf.urls.static import static

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)