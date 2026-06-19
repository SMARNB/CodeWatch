import os
import django
import random
from datetime import datetime, timedelta
from django.utils import timezone

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
django.setup()

from api.models import TrackedPerson, ViolationLog

def create_fake_data():
    print("🧹 Cleaning up old demo data...")
    # Delete only the fake data (starts with DEMO-) so we don't crash on duplicates
    TrackedPerson.objects.filter(employee_id__startswith="DEMO-").delete()
    
    print("🌱 Seeding Database with Fresh Demo Data...")

    # 1. Configuration
    departments = ['CS', 'EE', 'BBA', 'Law', 'Admin', 'Physics']
    roles = ['student', 'employee', 'visitor', 'faculty']
    violation_types = ['Dress Code', 'Unauthorized Access', 'Suspicious Behavior', 'No ID Card']

    # 2. Create 20 Fake People
    people = []
    for i in range(1, 2100):
        p = TrackedPerson.objects.create(
            name=f"Person {i}",
            employee_id=f"DEMO-{i:03d}",
            role=random.choice(roles),
            department=random.choice(departments),
            email=f"user{i}@university.edu"
        )
        people.append(p)
    print(f"✅ Created {len(people)} tracked people.")

    # 3. Create 50 Fake Violations (Past 30 Days)
    now = timezone.now()
    for _ in range(5000):
        # Random time in last 30 days
        days_ago = random.randint(0, 30)
        # Random hour (working hours mostly)
        hour = random.randint(8, 18)
        minute = random.randint(0, 59)
        
        random_time = now - timedelta(days=days_ago)
        random_time = random_time.replace(hour=hour, minute=minute)
        
        person = random.choice(people)
        v_type = random.choice(violation_types)
        
        ViolationLog.objects.create(
            person=person,
            violation_type=v_type,
            timestamp=random_time,
            confidence=random.uniform(0.85, 0.99)
        )
    print(f"✅ Created 50 violation logs.")
    print("🚀 DATABASE READY! Refresh your Analytics Page.")

if __name__ == '__main__':
    create_fake_data()