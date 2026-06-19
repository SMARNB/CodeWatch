import os
import django
import random
from datetime import timedelta
from django.utils import timezone

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from api.models import Notification

def run_seeder():
    print("Deleting old notifications...")
    Notification.objects.all().delete()

    data = [
        {
            "title": "Security violation detected at Camera 1",
            "message": "Unauthorized access attempt detected in restricted area Building A",
            "notif_type": "security"
        },
        {
            "title": "System maintenance completed",
            "message": "All security nodes have been updated to version 2.1.0",
            "notif_type": "system"
        },
        {
            "title": "Camera 3 offline",
            "message": "Network connectivity issues detected at West Gate",
            "notif_type": "security" # Mapped to Red in your frontend
        },
        {
            "title": "Daily backup completed",
            "message": "System logs and violation clips backed up to Cloud Storage",
            "notif_type": "backup"
        },
        {
            "title": "New user account created",
            "message": "Department Head account for 'CS Dept' registered successfully",
            "notif_type": "account"
        }
    ]

    print(f"Generating {len(data)} notifications...")
    
    for item in data:
        # Create notification with a slight time offset for realism
        n = Notification.objects.create(
            title=item['title'],
            message=item['message'],
            notif_type=item['notif_type'],
            is_read=random.choice([True, False])
        )
        # Randomize timestamp slightly
        n.timestamp = timezone.now() - timedelta(minutes=random.randint(5, 500))
        n.save()

    print("✅ Notifications generated successfully!")

if __name__ == "__main__":
    run_seeder()