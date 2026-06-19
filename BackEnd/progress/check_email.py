import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()
from django.conf import settings
print("BACKEND :", getattr(settings, 'EMAIL_BACKEND', None))
print("HOST    :", getattr(settings, 'EMAIL_ADDRESS', None))
print("PORT    :", getattr(settings, 'EMAIL_PORT', None))
print("USER    :", repr(getattr(settings, 'EMAIL_HOST_USER', None)))
print("PASS set:", bool(getattr(settings, 'EMAIL_HOST_PASSWORD', None)))
print("FROM    :", getattr(settings, 'DEFAULT_FROM_EMAIL', None))
