import os
import django

# 1. Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from api.models import Violation

def seed():
    print("Clearing old data and seeding new violations...")
    Violation.objects.all().delete()
    
    Violation.objects.create(violation_id="VIOL-001", type="Unauthorized Access", location="Building A - Floor 3", severity="High", status="Pending")
    Violation.objects.create(violation_id="VIOL-002", type="Security Breach", location="Building A - Floor 3", severity="High", status="Under Review")
    Violation.objects.create(violation_id="VIOL-003", type="Suspicious Activity", location="Building B - Floor 1", severity="Medium", status="Resolved")
    
    print("✅ Success: Database seeded for presentation!")

if __name__ == '__main__':
    seed()