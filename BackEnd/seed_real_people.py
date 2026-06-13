import os
import sys
import json
import numpy as np
import django
import cv2
import multiprocessing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CodeWatch.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth.models import User
from api.models import TrackedPerson, UserProfile
from insightface.app import FaceAnalysis

def main():
    print("Loading InsightFace model...")
    face_app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
    face_app.prepare(ctx_id=0, det_size=(640, 640))

    DEMO_FACES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo_faces')

    PEOPLE = [
        {
            "name": "Muhammad Ali Raza",
            "employee_id": "38622",
            "email": "38622@codewatch.com",
            "role": "student",
            "department": "Computer Science",
            "gender": "male",
            "semester": "8th",
            "photo": "ali.jpeg",
        },
    ]

    for person in PEOPLE:
        print(f"\nProcessing: {person['name']}")

        photo_path = os.path.join(DEMO_FACES_DIR, person['photo'])
        if not os.path.exists(photo_path):
            print(f"  SKIPPED: Photo not found at {photo_path}")
            continue

        img = cv2.imread(photo_path)
        if img is None:
            print(f"  ERROR: Could not read {photo_path}")
            continue

        faces = face_app.get(img)
        if not faces:
            print(f"  ERROR: No face detected in {photo_path}")
            continue

        faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
        embedding = faces[0].embedding.tolist()
        print(f"  Extracted 512-D embedding successfully")

        tp, created = TrackedPerson.objects.update_or_create(
            employee_id=person['employee_id'],
            defaults={
                'name': person['name'],
                'email': person['email'],
                'role': person['role'],
                'department': person['department'],
                'embedding_data': json.dumps(embedding),
                'classification': 'known'
            }
        )
        action = "Created" if created else "Updated"
        print(f"  {action}: {person['name']} ({person['employee_id']})")

    print("\n✅ Demo people seeded successfully!")

if __name__ == '__main__':
    multiprocessing.freeze_support()
    main()