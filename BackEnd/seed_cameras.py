import os
import django

# Set up the environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from api.models import Camera

def seed_cameras():
    print("🎥 Seeding Cameras...")
    
    # 1. Clear existing cameras (Optional - good for dev)
    Camera.objects.all().delete()
    print("   Cleared existing cameras.")

    # 2. Define Demo Cameras
    # We use local media files to simulate streams
    demo_cameras = [
        {
            "name": "Main Entrance Cam",
            "camera_id": "CAM-001",
            "location": "Main Entrance",
            "ip_address": "192.168.1.101",
            "status": "Active",
            "stream_url": "http://127.0.0.1:8000/media/1.mp4" 
        },
        {
            "name": "Lobby Wide Angle",
            "camera_id": "CAM-002",
            "location": "Lobby A",
            "ip_address": "192.168.1.102",
            "status": "Active",
            "stream_url": "http://127.0.0.1:8000/media/2.mp4"
        },
        {
            "name": "Corridor East",
            "camera_id": "CAM-003",
            "location": "Corridor East",
            "ip_address": "192.168.1.103",
            "status": "Active",
            "stream_url": "http://127.0.0.1:8000/media/1.mp4"
        },
        {
            "name": "Building B - Floor 2",
            "camera_id": "CAM-004",
            "location": "Building B",
            "ip_address": "192.168.1.104",
            "status": "Maintenance",
            "stream_url": "" # No stream for maintenance
        }
    ]

    # 3. Create Objects
    for cam_data in demo_cameras:
        Camera.objects.create(**cam_data)
        print(f"   CREATED: {cam_data['name']} ({cam_data['status']})")

    print(f"✅ Successfully seeded {len(demo_cameras)} cameras!")

if __name__ == "__main__":
    seed_cameras()
