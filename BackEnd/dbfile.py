import numpy as np
import os

DB_FILE = "face_db.npy"

def inspect_database():
    print("--- Reading Database File ---")
    
    # 1. Check if file exists
    if not os.path.exists(DB_FILE):
        print(f"❌ Error: Database file '{DB_FILE}' not found.")
        print("   Make sure you are in the 'backend' folder and have run the enrollment script.")
        return

    # 2. Load the data
    try:
        known_faces = np.load(DB_FILE, allow_pickle=True).tolist()
    except Exception as e:
        print(f"❌ Error loading database: {e}")
        return

    # 3. Print Summary
    print(f"\n📊 DATABASE REPORT ({len(known_faces)} people found)")
    print("=" * 65)
    print(f"{'NAME':<20} | {'STATUS':<15} | {'GENDER':<8} | {'SAMPLES'}")
    print("-" * 65)

    # 4. Loop through everyone
    if len(known_faces) == 0:
        print("   (Database is empty)")
    else:
        for i, person in enumerate(known_faces):
            name = person.get('name', 'Unknown')
            status = person.get('status', 'N/A')
            gender = person.get('gender', 'N/A')
            count = person.get('count', 1) 
            
            # Print the row
            print(f"{name:<20} | {status:<15} | {gender:<8} | {count}")

    print("=" * 65)
    print(f"✅ End of Report.\n")

if __name__ == "__main__":
    inspect_database()