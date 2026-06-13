import os
import django
import numpy as np
import json

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import UserProfile

def seed_mock_embedding():
    print("🚀 Seeding Mock Face Embedding...")
    
    # 1. Get or create the admin user
    user = User.objects.filter(username='admin_user').first()
    if not user:
        user = User.objects.create_user(username='admin_user', password='password123', email='admin@codewatch.com')
    
    # 2. Generate a random 512-dimensional normalized vector
    # This mimics a real face embedding shape (512,)
    mock_vector = np.random.rand(512).tolist()
    
    # 3. Update or create the UserProfile
    profile, created = UserProfile.objects.update_or_create(
        user=user,
        defaults={
            'role': 'admin',
            'face_embedding': json.dumps(mock_vector)
        }
    )
    
    print(f"✅ Success: Admin User '{user.username}' now has a valid 512-d embedding.")
    print("System logic should now bypass the Shape Alignment error.")

if __name__ == "__main__":
    seed_mock_embedding()