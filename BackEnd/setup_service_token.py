"""
One-time setup: create the 'codewatch-service' account that FinalSystem.py uses to authenticate
to the API, mint its API token, and store it as SERVICE_API_TOKEN in BackEnd/.env (preserving
every other line). Safe to re-run — it reuses the existing account/token.

Run from BackEnd:  python setup_service_token.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

SERVICE_USERNAME = 'codewatch-service'
ENV_PATH = os.path.join(os.path.dirname(__file__), '.env')

user, created = User.objects.get_or_create(
    username=SERVICE_USERNAME,
    defaults={'email': 'service@codewatch.local', 'is_active': True},
)
if created:
    user.set_unusable_password()  # token-only account; no password login
    user.save()

token, _ = Token.objects.get_or_create(user=user)

# Upsert SERVICE_API_TOKEN in .env without disturbing other entries.
lines = []
if os.path.exists(ENV_PATH):
    with open(ENV_PATH, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()
lines = [ln for ln in lines if not ln.startswith('SERVICE_API_TOKEN=')]
lines.append(f'SERVICE_API_TOKEN={token.key}')
with open(ENV_PATH, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f"Service account '{SERVICE_USERNAME}': {'created' if created else 'already existed'}")
print(f"SERVICE_API_TOKEN written to {ENV_PATH}")
