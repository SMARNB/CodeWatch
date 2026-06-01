import cv2
import time
import numpy as np
import requests
import json
import os
import threading
import base64
import redis
import glob
import traceback
from collections import defaultdict, deque
from deep_sort_realtime.deepsort_tracker import DeepSort
from insightface.app import FaceAnalysis
from ultralytics import YOLO

# --- CONFIGURATION ---
PARAMS = {
    "conf_threshold": 0.5,
    "similarity_threshold": 0.5,
    "log_interval": 30,
    "unknown_time_threshold": 3.0, # seconds before logging unknown
    "violation_cooldown": 30.0 # seconds before logging same unknown again
}

OUTPUT_DIR = r"C:\Users\alira\OneDrive\Documents\FYP\FrontEnd\public"
API_BASE_URL = "http://127.0.0.1:8000/api"
GET_EMBEDDINGS_URL = f"{API_BASE_URL}/get-embeddings/"
LOG_VIOLATION_URL = f"{API_BASE_URL}/log-violation/"
GET_CAMERAS_URL = f"{API_BASE_URL}/cameras/"
GET_BLACKLIST_URL = f"{API_BASE_URL}/blacklist/"
LOG_MOVEMENT_URL = f"{API_BASE_URL}/movement-log/"
REGISTER_UNKNOWN_URL = f"{API_BASE_URL}/register-unknown/"

# Redis Connection
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Global State
global_registry = [] # List of {'id': int, 'name': str, 'embedding': np.array}
global_blacklist = set() # Set of DB IDs that are blacklisted

# Thread Locks
insightface_lock = threading.Lock()
state_lock = threading.Lock()

# Violation cooldown state
violation_last_logged = {} # key: (camera_id, track_id), val: timestamp

# Tracking & Highlighting State
highlight_person_id = None
camera_active_persons = {} # {camera_id: {person_id: last_seen_timestamp}}

# --- SETUP MODELS ---
print("🧠 Loading Global AI Models... (YOLO + InsightFace)")
try:
    yolo_model_base = YOLO("yolo26n-seg.pt") 
except Exception as e:
    print(f"⚠️ Could not load yolo26n-seg.pt. Trying fallback.")
    yolo_model_base = YOLO("yolo11n-seg.pt")

print("👗 Loading Dress Code Model...")
DRESSCODE_MODEL_PATH = r"C:\Users\alira\OneDrive\Documents\FYP\BackEnd\runs\detect\dresscode_runs\codewatch_dresscode_v2\weights\best.pt"
try:
    dresscode_model = YOLO(DRESSCODE_MODEL_PATH)
except Exception as e:
    print(f"⚠️ Could not load dress code model: {e}")
    dresscode_model = None

COMPLIANT_MALE = {'m-button-down', 'm-formal-trousers', 'm-kurta', 'm-shalwar', 'm-shirts'}
COMPLIANT_FEMALE = {'w-dress', 'w-dupatta', 'w-eastern-trouser', 'w-kameez', 'w-shalwar'}
VIOLATION_MALE = {'m-informal-pants', 'm-sleeveless'}
VIOLATION_FEMALE = {'w-western-shirt', 'w-western-trouser', 'm-sleeveless'}
NEUTRAL = {'outerwear'}

track_histories = defaultdict(lambda: defaultdict(lambda: deque(maxlen=50)))

app = FaceAnalysis(name='buffalo_l', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app.prepare(ctx_id=0, det_size=(640, 640))

def load_registry_and_blacklist():
    global global_registry, global_blacklist
    with state_lock:
        print("📡 Refreshing Registry & Blacklist via API...")
        # Registry
        try:
            response = requests.get(GET_EMBEDDINGS_URL, timeout=5)
            if response.status_code == 200:
                data = response.json()
                new_reg = []
                for db_id_str, info in data.items():
                    raw_list = info.get('embeddings')
                    if not raw_list:
                        single = info.get('embedding')
                        raw_list = [single] if single else []
                    emb_arrays = []
                    for raw_emb in raw_list:
                        arr = np.array(raw_emb, dtype=np.float32).flatten()
                        if arr.shape[0] == 512:
                            emb_arrays.append(arr)
                    if emb_arrays:
                        new_reg.append({
                            "id": int(db_id_str),
                            "name": info['name'],
                            "embeddings": emb_arrays,
                            "classification": info.get('classification', 'unknown')
                        })
                global_registry = new_reg
                total_emb = sum(len(f['embeddings']) for f in new_reg)
                print(f"✅ Loaded {len(global_registry)} known faces ({total_emb} embeddings).")
        except Exception as e:
            print(f"⚠️ Registry fetch failed: {e}")

        # Blacklist
        try:
            response = requests.get(GET_BLACKLIST_URL, timeout=5)
            if response.status_code == 200:
                data = response.json()
                new_bl = set()
                for item in data:
                    if 'person_id' in item:
                        new_bl.add(int(item['person_id']))
                    elif 'id' in item:
                        new_bl.add(int(item['id']))
                global_blacklist = new_bl
                print(f"✅ Loaded {len(global_blacklist)} blacklisted individuals.")
        except Exception as e:
             pass 

def get_cameras():
    try:
        response = requests.get(GET_CAMERAS_URL, timeout=5)
        if response.status_code == 200:
            return {cam['camera_id']: cam for cam in response.json() if cam.get('is_active', True)}
    except Exception as e:
        print(f"⚠️ Could not fetch cameras: {e}")
    return {}

def cosine_similarity(target_emb, db_matrix):
    target = np.array(target_emb, dtype=np.float32).flatten()
    norm_db = np.linalg.norm(db_matrix, axis=1, keepdims=True)
    norm_target = np.linalg.norm(target)
    if norm_target == 0: return np.zeros(db_matrix.shape[0])
    sims = np.dot(db_matrix, target) / (norm_db.flatten() * norm_target)
    return sims

def find_match_in_redis(target_emb):
    """Check Redis global_identity keys for existing matches across cameras."""
    try:
        keys = redis_client.keys("global_identity:*")
        if not keys: return None, 0.0, None
        
        cached_identities = []
        cached_embeddings = []
        for key in keys:
            val = redis_client.get(key)
            if val:
                data = json.loads(val)
                if 'embedding' in data:
                    cached_identities.append((data['id'], data['name']))
                    cached_embeddings.append(data['embedding'])
                    
        if cached_embeddings:
            db_matrix = np.array(cached_embeddings)
            sims = cosine_similarity(target_emb, db_matrix)
            best_idx = np.argmax(sims)
            max_score = sims[best_idx]
            
            if max_score > PARAMS["similarity_threshold"]:
                pid, name = cached_identities[best_idx]
                return pid, float(max_score), name
    except Exception as e:
        print(f"Redis match error: {e}")
    return None, 0.0, None

def find_match_in_db(target_emb):
    """Check local DB cache (global_registry); score against each person's BEST embedding."""
    with state_lock:
        if not global_registry:
            return None, 0.0, "Unknown", "unknown"

        all_rows = []
        owner = []
        for idx, f in enumerate(global_registry):
            for emb in f['embeddings']:
                all_rows.append(emb)
                owner.append(idx)

        if not all_rows:
            return None, 0.0, "Unknown", "unknown"

        db_matrix = np.array(all_rows)
        sims = cosine_similarity(target_emb, db_matrix)
        best_row = int(np.argmax(sims))
        max_score = float(sims[best_row])

        if max_score > PARAMS["similarity_threshold"]:
            match = global_registry[owner[best_row]]
            return match['id'], max_score, match['name'], match.get('classification', 'unknown')

    return None, 0.0, "Unknown", "unknown"

def numpy_to_base64(img):
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')

class CameraThread(threading.Thread):
    def __init__(self, camera_data):
        super().__init__()
        self.camera_data = camera_data
        self.camera_id = camera_data['camera_id']
        self.name = camera_data['name']
        self.stream_url = camera_data['stream_url']
        self.running = True
        
        print(f"[{self.camera_id}] Initializing YOLO & DeepSort...")
        self.model = YOLO("yolo26n-seg.pt") if os.path.exists("yolo26n-seg.pt") else YOLO("yolo11n-seg.pt")
        self.tracker = DeepSort(max_age=30, n_init=3)
        self.unknown_track_timers = {} 
        self.pending_registrations = {}  # {track_id: person_id}
        self.registration_in_progress = set()
        self.save_counter = 0
        self.fps_history = deque(maxlen=10)

    def async_post(self, url, data):
        threading.Thread(target=lambda: requests.post(url, json=data, timeout=2), daemon=True).start()

    def register_unknown_async(self, track_id, embedding, snapshot, camera_id):
        if track_id in self.registration_in_progress:
            return
        self.registration_in_progress.add(track_id)
        def do_register():
            try:
                resp = requests.post(REGISTER_UNKNOWN_URL, json={
                    "embedding": embedding,
                    "snapshot": snapshot,
                    "camera_id": camera_id
                }, timeout=3)
                if resp.status_code == 200 or resp.status_code == 201:
                    data = resp.json()
                    self.pending_registrations[track_id] = {
                        "id": data.get("person_id"),
                        "name": data.get("name", "Unknown"),
                    }
            except Exception as e:
                print(f"Registration failed: {e}")
            finally:
                self.registration_in_progress.discard(track_id)
        threading.Thread(target=do_register, daemon=True).start()

    def run(self):
        print(f"🚀 Camera {self.name} ({self.camera_id}) connected at {self.stream_url}")
        
        # Support both RTSP URLs (string) and webcam indices (integer)
        if self.stream_url.isdigit():
            cap = cv2.VideoCapture(int(self.stream_url))
        else:
            cap = cv2.VideoCapture(self.stream_url)
        frame_count = 0
        frame_skip = 3 if self.camera_id in ["CAM-002", "CAM-003"] else 1
        
        while self.running:
            success, frame = cap.read()
            if not success:
                print(f"🔄 [{self.camera_id}] Video feed dropped, retrying in 5 seconds...")
                cap.release()
                time.sleep(5)
                if self.stream_url.isdigit():
                    cap = cv2.VideoCapture(int(self.stream_url))
                else:
                    cap = cv2.VideoCapture(self.stream_url)
                continue

            frame_count += 1
            if frame_count % frame_skip != 0:
                continue

            start_time = time.time()

            # 1. DETECT
            clean_frame = frame.copy()
            
            skip_dresscode = False
            if len(self.fps_history) == 10:
                avg_fps = sum(self.fps_history) / 10.0
                if avg_fps < 5.0 and not getattr(self, 'skip_dresscode', False):
                    print(f"WARNING: {self.camera_id} FPS {avg_fps:.1f} - skipping dress code")
                    self.skip_dresscode = True
                elif avg_fps > 10.0 and getattr(self, 'skip_dresscode', False):
                    self.skip_dresscode = False
            skip_dresscode = getattr(self, 'skip_dresscode', False)
            
            results = self.model(frame, conf=PARAMS["conf_threshold"], classes=0, verbose=False)
            detections = []
            
            if len(results) > 0:
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    w, h = x2 - x1, y2 - y1
                    conf = float(box.conf[0].cpu().numpy())
                    
                    detections.append(([x1, y1, w, h], conf, 'person', None))
                    
            # 2. TRACK
            tracks = self.tracker.update_tracks(detections, frame=frame)
            person_count = 0
            tracking_frame_to_save = None
            tracking_frame_path = None
            
            for track in tracks:
                if not track.is_confirmed(): continue
                person_count += 1
                
                ltrb = track.to_ltrb()
                x1, y1, x2, y2 = int(ltrb[0]), int(ltrb[1]), int(ltrb[2]), int(ltrb[3])
                track_id = track.track_id
                
                # Append to track histories
                center_x = int((x1 + x2) / 2)
                center_y = int((y1 + y2) / 2)
                track_histories[self.camera_id][track_id].append((center_x, center_y))
                
                # Optimization: Track-then-identify
                needs_insightface = False
                if not hasattr(track, 'identity'):
                    needs_insightface = True
                    track.frames_since_check = 0
                elif not track.identity.get('confirmed'):
                    needs_insightface = True
                elif track.identity.get('name') == "Unknown":
                    track.frames_since_check += 1
                    if track.frames_since_check > 30:
                        needs_insightface = True
                        track.frames_since_check = 0
                        
                current_emb = None
                if needs_insightface:
                    # Expand crop by 30% for better context
                    h, w = y2 - y1, x2 - x1
                    pad_h, pad_w = int(h * 0.3), int(w * 0.3)
                    crop_y1 = max(0, y1 - pad_h)
                    crop_y2 = min(frame.shape[0], y2 + pad_h)
                    crop_x1 = max(0, x1 - pad_w)
                    crop_x2 = min(frame.shape[1], x2 + pad_w)
                    person_crop = frame[crop_y1:crop_y2, crop_x1:crop_x2]
                    if person_crop.size > 0:
                        with insightface_lock:
                            faces = app.get(person_crop)
                        if faces:
                            faces.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
                            current_emb = faces[0].embedding.tolist()
                            
                # Identity Resolution
                matched_name = "Unknown"
                matched_id = None
                matched_classification = "unknown"
                
                if current_emb is not None:
                    # a) Check Redis first
                    pid, score, name = find_match_in_redis(current_emb)
                    if pid:
                        if not hasattr(track, 'identity') or track.identity.get('id') != pid:
                             print(f"🤝 HANDOVER: {name} moved to {self.camera_id}")
                        track.identity = {"id": pid, "name": name, "confirmed": True}
                        matched_name = name
                        matched_id = pid
                        
                    # b) Check DB
                    if not matched_id:
                        pid, score, name, classification = find_match_in_db(current_emb)
                        if pid:
                            track.identity = {"id": pid, "name": name, "confirmed": True, "classification": classification}
                            matched_name = name
                            matched_id = pid
                            matched_classification = classification
                            print(f"🟢 {self.camera_id}: Identified {name} (score: {score:.2f})")
                            


                elif hasattr(track, 'identity'):
                    matched_name = track.identity.get("name", "Unknown")
                    matched_id = track.identity.get("id")
                    matched_classification = track.identity.get("classification", "unknown")

                if matched_id and matched_name != "Unknown":
                    try:
                        redis_data = json.dumps({
                            "camera_id": self.camera_id,
                            "track_id": track_id,
                            "last_seen_timestamp": time.time(),
                            "name": matched_name,
                            "id": matched_id,
                            "embedding": current_emb if current_emb else [],
                            "confidence": 1.0
                        })
                        redis_client.setex(f"global_identity:{matched_id}", 30, redis_data)
                    except Exception as e:
                        print(f"Redis write error: {e}")
                    
                # Movement Logging Tracker
                track_identifier = matched_id if matched_id else f"unknown_{track_id}"
                if self.camera_id not in camera_active_persons:
                    camera_active_persons[self.camera_id] = {}
                    
                if track_identifier not in camera_active_persons[self.camera_id]:
                    self.async_post(LOG_MOVEMENT_URL, {
                        "person_id": track_identifier,
                        "camera_id": self.camera_id,
                        "action": "enter"
                    })
                    
                camera_active_persons[self.camera_id][track_identifier] = time.time()
                    
                # Dress code check
                detected_clothes = []
                is_violation = False
                is_compliant = True
                violation_classes = []
                
                # Expand crop by 30% for better context
                h, w = y2 - y1, x2 - x1
                pad_h, pad_w = int(h * 0.3), int(w * 0.3)
                crop_y1 = max(0, y1 - pad_h)
                crop_y2 = min(frame.shape[0], y2 + pad_h)
                crop_x1 = max(0, x1 - pad_w)
                crop_x2 = min(frame.shape[1], x2 + pad_w)
                track_crop = frame[crop_y1:crop_y2, crop_x1:crop_x2]
                
                if dresscode_model and track_crop.size > 0 and not skip_dresscode:
                    dc_results = dresscode_model(track_crop, conf=0.5, verbose=False)
                    for r in dc_results:
                        for box in r.boxes:
                            cls_id = int(box.cls[0].item())
                            cls_name = dresscode_model.names[cls_id]
                            detected_clothes.append(cls_name)
                    
                    if detected_clothes:
                        m_count = sum(1 for c in detected_clothes if c.startswith('m-'))
                        w_count = sum(1 for c in detected_clothes if c.startswith('w-'))
                        
                        gender = 'male' if m_count >= w_count else 'female'
                        
                        if gender == 'male':
                            violation_classes = [c for c in detected_clothes if c in VIOLATION_MALE]
                        else:
                            violation_classes = [c for c in detected_clothes if c in VIOLATION_FEMALE]
                            
                        if violation_classes:
                            is_violation = True
                            is_compliant = False
                            
                        if is_violation:
                            now = time.time()
                            dc_key = (self.camera_id, track_id, "dresscode")
                            last_logged = violation_last_logged.get(dc_key, 0)
                            if (now - last_logged) > PARAMS["violation_cooldown"]:
                                violation_last_logged[dc_key] = now
                                print(f"DRESS CODE VIOLATION: {matched_name} on {self.camera_id} - detected {violation_classes}")
                                snap_b64 = numpy_to_base64(track_crop)
                                log_data = {
                                    "person_id": matched_id if matched_name != "Unknown" else None,
                                    "type": f"Dress Code Violation ({', '.join(violation_classes)})",
                                    "conf": 1.0,
                                    "snapshot": snap_b64,
                                    "camera_id": self.camera_id
                                }
                                self.async_post(LOG_VIOLATION_URL, log_data)

                # Unknown Handling & Logging
                if matched_name == "Unknown":
                    now = time.time()
                    if track_id not in self.unknown_track_timers:
                        self.unknown_track_timers[track_id] = now
                    
                    first_seen = self.unknown_track_timers[track_id]
                    duration = now - first_seen
                    
                    # Store Unknown in Redis
                    if current_emb:
                        try:
                            snap_b64 = numpy_to_base64(track_crop) if track_crop.size > 0 else ""
                            u_data = json.dumps({
                                "first_seen": first_seen,
                                "last_seen": now,
                                "embedding": current_emb,
                                "snapshot_base64": snap_b64
                            })
                            redis_client.setex(f"unknown:{self.camera_id}:{track_id}", 300, u_data)
                        except Exception as e:
                            pass

                    # Log Violation > 3s
                    if duration > PARAMS["unknown_time_threshold"]:
                        last_logged = violation_last_logged.get((self.camera_id, track_id), 0)
                        if (now - last_logged) > PARAMS["violation_cooldown"]:
                            print(f"🚨 VIOLATION: Unauthorized person on {self.camera_id}")
                            violation_last_logged[(self.camera_id, track_id)] = now
                            snap_b64 = numpy_to_base64(track_crop) if track_crop.size > 0 else ""
                            
                            if current_emb and not hasattr(track, 'registered'):
                                self.register_unknown_async(track_id, current_emb, snap_b64, self.camera_id)
                                
                            if track_id in self.pending_registrations:
                                reg = self.pending_registrations.pop(track_id)
                                person_id = reg["id"]
                                name = reg["name"]
                                track.identity = {"id": person_id, "name": name, "confirmed": True, "classification": "unknown"}
                                track.registered = True
                                matched_id = person_id
                                matched_name = name
                                
                                try:
                                    redis_data = json.dumps({
                                        "camera_id": self.camera_id,
                                        "track_id": track_id,
                                        "last_seen_timestamp": time.time(),
                                        "name": name,
                                        "id": person_id,
                                        "embedding": current_emb,
                                        "confidence": 0.0
                                    })
                                    redis_client.setex(f"global_identity:{person_id}", 30, redis_data)
                                except Exception as e:
                                    pass
                                
                                log_data = {
                                    "person_id": person_id, 
                                    "type": "Unauthorized Access",
                                    "conf": 0.0,
                                    "snapshot": snap_b64,
                                    "camera_id": self.camera_id
                                }
                                self.async_post(LOG_VIOLATION_URL, log_data)
                                
                                self.async_post(LOG_MOVEMENT_URL, {
                                    "person_id": person_id,
                                    "camera_id": self.camera_id,
                                    "action": "enter"
                                })
                                
                                if self.camera_id not in camera_active_persons:
                                    camera_active_persons[self.camera_id] = {}
                                camera_active_persons[self.camera_id][person_id] = time.time()
                else:
                    if track_id in self.unknown_track_timers:
                        del self.unknown_track_timers[track_id]
                        
                    with state_lock:
                        if matched_id in global_blacklist:
                            now = time.time()
                            last_logged = violation_last_logged.get((self.camera_id, track_id), 0)
                            if (now - last_logged) > PARAMS["violation_cooldown"]:
                                print(f"🚨 VIOLATION: Blacklisted Person Detected on {self.camera_id} ({matched_name})")
                                violation_last_logged[(self.camera_id, track_id)] = now
                                snap_b64 = numpy_to_base64(track_crop) if track_crop.size > 0 else ""
                                log_data = {
                                    "person_id": matched_id,
                                    "type": "Blacklisted Person Detected",
                                    "conf": 1.0,
                                    "snapshot": snap_b64,
                                    "camera_id": self.camera_id
                                }
                                self.async_post(LOG_VIOLATION_URL, log_data)

                # Visualization
                color = (0, 0, 255) # Red
                label = "UNKNOWN"
                trail_color = (0, 0, 255) # Red
                thickness = 2
                
                if matched_name != "Unknown":
                    with state_lock:
                        if matched_id in global_blacklist:
                            color = (128, 0, 128) # Purple
                            label = f"BLACKLISTED: {matched_name}"
                            trail_color = (128, 0, 128) # Purple
                        elif matched_classification == 'visitor' or "visitor" in matched_name.lower():
                            color = (255, 200, 0) # Cyan/Blue
                            label = f"VISITOR: {matched_name}"
                            trail_color = (255, 200, 0) # Cyan/Blue
                        else:
                            color = (0, 255, 0) # Green
                            label = matched_name
                            trail_color = (0, 255, 0) # Green
                            if is_violation:
                                trail_color = (0, 165, 255) # Orange
                
                if highlight_person_id and highlight_person_id == matched_id:
                    color = (0, 255, 255) # Yellow
                    label = f">>> TRACKING: {matched_name} <<<"
                    trail_color = (0, 255, 255) # Yellow
                    thickness = 4
                            
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)
                cv2.putText(frame, label, (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, thickness)
                
                if detected_clothes:
                    if is_violation:
                        dc_text = f"Dress: VIOLATION ({', '.join(violation_classes)})"
                        cv2.putText(frame, dc_text, (x1, y1+15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                    else:
                        dc_text = f"Dress: Compliant ({', '.join(detected_clothes)})"
                        cv2.putText(frame, dc_text, (x1, y1+15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                        
                pts = list(track_histories[self.camera_id][track_id])
                for i in range(1, len(pts)):
                    line_thickness = 3 if (highlight_person_id and highlight_person_id == matched_id) else max(1, int(2 * (i / len(pts))))
                    cv2.line(frame, pts[i-1], pts[i], trail_color, line_thickness)

                if highlight_person_id and highlight_person_id == matched_id:
                    tracking_frame = clean_frame.copy()
                    overlay = tracking_frame.copy()
                    cv2.rectangle(overlay, (0,0), (tracking_frame.shape[1], tracking_frame.shape[0]), (0,0,0), -1)
                    tracking_frame = cv2.addWeighted(overlay, 0.5, tracking_frame, 0.5, 0)
                    
                    cv2.rectangle(tracking_frame, (x1, y1), (x2, y2), (0, 255, 255), 3)
                    cv2.putText(tracking_frame, f"TRACKING: {matched_name}", (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 3)
                    
                    for i in range(1, len(pts)):
                        cv2.line(tracking_frame, pts[i-1], pts[i], (0, 255, 255), max(1, int(2 * (i / len(pts)))))
                        
                    tracking_frame_to_save = tracking_frame
                    tracking_frame_path = os.path.join(OUTPUT_DIR, f"live_feed_track_{matched_id}.jpg")
                    
                    try:
                        redis_client.setex(f"track_camera:{matched_id}", 30, self.camera_id)
                    except:
                        pass

            # Cleanup inactive persons
            now = time.time()
            if self.camera_id in camera_active_persons:
                to_remove = []
                for pid, last_seen in camera_active_persons[self.camera_id].items():
                    if now - last_seen > 5.0:
                        self.async_post(LOG_MOVEMENT_URL, {
                            "person_id": pid,
                            "camera_id": self.camera_id,
                            "action": "exit"
                        })
                        to_remove.append(pid)
                for pid in to_remove:
                    del camera_active_persons[self.camera_id][pid]

            # Draw Overlay
            fps = 1.0 / (time.time() - start_time + 1e-6)
            self.fps_history.append(fps)
            cv2.putText(frame, f"{self.name} | FPS: {fps:.1f} | People: {person_count}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            
            # Save Frame
            self.save_counter += 1
            
            # Always save tracking frame (for NotificationDetailsPage live feed)
            if tracking_frame_to_save is not None:
                try:
                    cv2.imwrite(tracking_frame_path, tracking_frame_to_save)
                except:
                    pass

            # Save dashboard frame every 3rd frame (for dashboard performance)
            if self.save_counter % 3 == 0:
                out_path = os.path.join(OUTPUT_DIR, f"live_feed_{self.camera_id}.jpg")
                try:
                    cv2.imwrite(out_path, frame)
                except:
                    pass
                
        cap.release()
        print(f"🛑 Thread {self.camera_id} stopped.")

class WatcherThread(threading.Thread):
    def __init__(self):
        super().__init__()
        self.running = True
        self.last_highlight_person_id = None

    def run(self):
        global highlight_person_id
        print("👁️ Watcher Thread started.")
        while self.running:
            load_registry_and_blacklist()
            
            if highlight_person_id != self.last_highlight_person_id:
                try:
                    old_files = glob.glob(os.path.join(OUTPUT_DIR, "live_feed_track_*.jpg"))
                    for f in old_files:
                        os.remove(f)
                except Exception as e:
                    print(f"Error cleaning up old track frames: {e}")
                self.last_highlight_person_id = highlight_person_id
                
            cameras = get_cameras()
            for cid, cdata in cameras.items():
                if cid not in active_camera_threads or not active_camera_threads[cid].is_alive():
                    print(f"🎥 Detected new or crashed camera: {cid}. Starting thread.")
                    t = CameraThread(cdata)
                    active_camera_threads[cid] = t
                    t.start()
            
            for _ in range(30):
                if not self.running: break
                try:
                    val = redis_client.get("track_highlight")
                    highlight_person_id = int(val) if val else None
                except Exception:
                    pass
                time.sleep(2)

active_camera_threads = {}

if __name__ == "__main__":
    print("====================================")
    print("🛡️ Multi-Camera tracking system starting...")
    print("====================================")
    
    load_registry_and_blacklist()
    
    watcher = WatcherThread()
    watcher.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Graceful Shutdown Initiated...")
        watcher.running = False
        for cid, t in active_camera_threads.items():
            t.running = False
        
        watcher.join()
        for cid, t in active_camera_threads.items():
            t.join()
            
        try:
            redis_client.close()
        except:
            pass
        print("✅ Shutdown complete.")