from django.contrib.auth.models import User
from api.models import UserProfile

username = "guard@codewatch.com"
email = "guard@codewatch.com"
password = "password123"
role = "guard"

try:
    if not User.objects.filter(username=username).exists():
        user = User.objects.create_user(username=username, email=email, password=password)
        UserProfile.objects.create(user=user, role=role)
        print(f"User {username} created successfully with role {role}.")
    else:
        print(f"User {username} already exists.")
except Exception as e:
    print(f"Error creating user: {e}")
