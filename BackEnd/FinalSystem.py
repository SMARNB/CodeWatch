import cv2
import time
import numpy as np
import requests
import json
import os
from deep_sort_realtime.deepsort_tracker import DeepSort
from insightface.app import FaceAnalysis
from ultralytics import YOLO


# --- CONFIGURATION ---
CAMERA_ID = "CAM-001"  # Set the Target Camera ID here
PARAMS = {
    "conf_threshold": 0.5,
    "similarity_threshold": 0.5, # Adjusted threshold
    "log_interval": 30 # Frames between logs
}

# OUTPUT IMAGE
OUTPUT_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\FrontEnd\public\live_feed.jpg"

# API ENDPOINTS
API_BASE_URL = "http://127.0.0.1:8000/api"
GET_EMBEDDINGS_URL = f"{API_BASE_URL}/get-embeddings/"
LOG_VIOLATION_URL = f"{API_BASE_URL}/log-violation/"
GET_CAMERAS_URL = f"{API_BASE_URL}/cameras/"

# --- SETUP MODELS ---
print("🧠 Loading AI Models... (YOLO + InsightFace)")
model = YOLO("yolo11n-seg.pt")
app = FaceAnalysis(providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))
tracker = DeepSort(max_age=30, n_init=3)

# Global Registry
global_registry = [] # List of {'id': int, 'name': str, 'embedding': np.array}

def load_registry():
    """Fetches embeddings from API and populates global_registry."""
    global global_registry
    global_registry = []
    
    print("📡 Connecting to Database via API...")
    try:
        response = requests.get(GET_EMBEDDINGS_URL, timeout=2)
        if response.status_code == 200:
            data = response.json()
            # data is { "id": {"name": "...", "embedding": [...]} }
            
            for db_id_str, info in data.items():
                try:
                    # Parse embedding
                    raw_emb = info['embedding']
                    emb_array = np.array(raw_emb, dtype=np.float32).flatten()
                    
                    # Validate Vector
                    if emb_array.shape[0] == 512:
                        global_registry.append({
                            "id": int(db_id_str),
                            "name": info['name'],
                            "embedding": emb_array
                        })
                    else:
                        print(f"⚠️ Skipping ID {db_id_str}: Invalid shape {emb_array.shape}")
                        
                except Exception as ex:
                    print(f"⚠️ Error parsing ID {db_id_str}: {ex}")
                    
            print(f"✅ Loaded {len(global_registry)} VALID known faces.")
        else:
            print(f"⚠️ API Error: {response.status_code}")
            
    except Exception as e:
        print(f"⚠️ Offline Mode: Database not connected. {e}")

def get_video_source():
    """Determines the video source dynamically."""
    default_source = "2.mp4"
    try:
        response = requests.get(GET_CAMERAS_URL, timeout=2)
        if response.status_code == 200:
            cameras = response.json()
            target = next((c for c in cameras if c['camera_id'] == CAMERA_ID), None)
            if target:
                print(f"🎥 Found Camera: {target['name']}")
                stream = target['stream_url']
                # Local file check for simulation
                if "127.0.0.1" in stream and "media" in stream:
                    fname = stream.split('/')[-1]
                    if os.path.exists(fname): return fname
                return stream
        print(f"⚠️ Camera {CAMERA_ID} not found/offline. Using fallback.")
    except:
        print("⚠️ Could not fetch cameras. Using fallback.")
    return default_source

def find_match(target_emb, threshold=0.5):
    """Compares live face against list of dicts."""
    if not global_registry:
        return None, 0.0, "Unknown"

    try:
        # Build matrix: (N, 512)
        db_matrix = np.array([f['embedding'] for f in global_registry])
        
        # Prepare target: (512,)
        target = np.array(target_emb, dtype=np.float32).flatten()
        
        # Normalize for Cosine Similarity
        # (Assuming DB embeddings are not pre-normalized, so we normalize both just in case)
        # Note: InsightFace embeddings are usually not normalized by default.
        # Cosine Sim = dot(A, B) / (norm(A) * norm(B))
        
        norm_db = np.linalg.norm(db_matrix, axis=1, keepdims=True)
        norm_target = np.linalg.norm(target)
        
        # Avoid div by zero
        if norm_target == 0: return None, 0.0, "Unknown"
        
        # Cosine Similarity
        sims = np.dot(db_matrix, target) / (norm_db.flatten() * norm_target)
        
        best_idx = np.argmax(sims)
        max_score = sims[best_idx]
        
        if max_score > threshold:
            match = global_registry[best_idx]
            return match['id'], float(max_score), match['name']
            
    except Exception as e:
        print(f"Match Error: {e}")
        
    return None, 0.0, "Unknown"

# --- INITIALIZATION ---
load_registry()
video_source = get_video_source()

# --- MAIN LOOP ---
cap = cv2.VideoCapture(video_source)
frame_count = 0

print(f"🚀 STARTING VIDEO LOOP on {video_source}...")

while True:
    success, frame = cap.read()
    if not success:
        print("🔄 Video ended, restarting...")
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        continue

    frame_count += 1
    
    # 1. DETECT
    results = model(frame, conf=PARAMS["conf_threshold"], classes=0, verbose=False)
    detections = []
    
    if len(results) > 0:
        for box in results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
            w, h = x2 - x1, y2 - y1
            conf = float(box.conf[0].cpu().numpy())
            
            # Extract Embedding
            person_crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
            emb = None
            if person_crop.size > 0:
                faces = app.get(person_crop)
                faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
                if faces:
                    emb = faces[0].embedding
            
            detections.append(([x1, y1, w, h], conf, 'person', emb))
            
    # 2. TRACK
    tracks = tracker.update_tracks(detections, frame=frame)
    
    for track in tracks:
        if not track.is_confirmed(): continue
        
        ltrb = track.to_ltrb()
        x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
        track_id = track.track_id
        
        # Identify
        # Simple strategy: If current step has a detection with embedding that overlaps this track, match it.
        # DeepSort's 'track' object doesn't easily link back to specific detection index unfortunately.
        # We perform IoU matching again to find the embedding.
        
        current_emb = None
        best_iou = 0
        
        for (dbox, _, _, demb) in detections:
            if demb is None: continue
            
            # IoU calc
            dx1, dy1, dw, dh = dbox
            dx2, dy2 = dx1+dw, dy1+dh
            
            xx1 = max(x1, dx1); yy1 = max(y1, dy1)
            xx2 = min(x2, dx2); yy2 = min(y2, dy2)
            inter = max(0, xx2-xx1) * max(0, yy2-yy1)
            union = (x2-x1)*(y2-y1) + dw*dh - inter
            
            if union > 0:
                iou = inter/union
                if iou > 0.5 and iou > best_iou:
                    best_iou = iou
                    current_emb = demb
        
        # Persistent Identity Logic
        matched_name = "Unknown"
        matched_id = None
        
        if current_emb is not None:
             mid, score, mname = find_match(current_emb, PARAMS["similarity_threshold"])
             if mid:
                 track.identity = {"id": mid, "name": mname} # Save to track
                 matched_name = mname
                 matched_id = mid
        elif hasattr(track, 'identity'):
             matched_name = track.identity["name"]
             matched_id = track.identity["id"]
             
        # Visualize
        color = (0, 255, 0) if matched_name != "Unknown" else (0, 0, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{matched_name}", (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        # Log Violation
        if frame_count % PARAMS["log_interval"] == 0:
            if matched_name == "Unknown":
                # Unauthorized Access
                log_data = {"person_id": 1, "type": "Unauthorized Access", "conf": 0.0}
                if matched_id: log_data['person_id'] = matched_id # Should not happen if unknown, but safe fallback
                
                # If we have a 'known' person but flagging them?
                # Logic: Unknown = Unauthorized.
                # Known = No Violation (unless specific rules applied, omitted here for simplicity)
                
                # To log 'Unknown', we need a person_id. 
                # We can use a special ID or just 1 (Admin) and text says "Unauthorized".
                # Let's stick to 1 for generic logging if unknown.
                
                try: requests.post(LOG_VIOLATION_URL, json=log_data, timeout=0.1)
                except: pass

    # Save
    try: cv2.imwrite(OUTPUT_PATH, frame)
    except: pass
    
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()