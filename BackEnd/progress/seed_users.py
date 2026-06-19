import os
import django

# Set up the environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import UserProfile

def create_users():
    users_to_create = [
        {'username': 'admin_user', 'email': 'admin@codewatch.com', 'role': 'admin'},
        {'username': 'ssd_user', 'email': 'ssd@codewatch.com', 'role': 'ssd'},
        {'username': 'dept_head_user', 'email': 'dept@codewatch.com', 'role': 'department-head'},
    ]

    for data in users_to_create:
        # Use the email as the username for Django's internal system
        # Check if user exists by email-as-username
        user = User.objects.filter(username=data['email']).first()
        
        if not user:
            print(f"Creating user for {data['email']}...")
            user = User.objects.create_user(
                username=data['email'], # This allows login via email
                email=data['email'],
                password='password123'
            )
        else:
            print(f"Updating password for {data['email']}...")
            user.set_password('password123')
            user.save()
            
        # Ensure the Profile exists and has the right role
        UserProfile.objects.update_or_create(
            user=user, 
            defaults={'role': data['role']}
        )
        print(f"✅ User Ready: {data['email']} ({data['role']})")

if __name__ == "__main__":
    create_users()