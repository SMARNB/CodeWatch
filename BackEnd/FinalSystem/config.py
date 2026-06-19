"""Configuration & constants for the CodeWatch CV engine.

Everything here is read-only after import: tunable parameters, layout-independent file paths,
API endpoints, the service-account auth header, and the day-one dress-code defaults. The
*live* (mutable) state lives in runtime_state.py.
"""
import os

# RTSP/NVR streams: force TCP transport so they don't tear or drop on packet loss. Must be set
# before any cv2.VideoCapture is opened — config is imported before the camera threads start.
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

# --- Layout-independent paths -------------------------------------------------------------
# Derived from this file's location so the engine runs from any working directory. The package
# sits one level deeper than the old monolith (BackEnd/FinalSystem/ vs BackEnd/), hence the
# extra dirname compared with the original.
PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))      # .../BackEnd/FinalSystem
BACKEND_DIR = os.path.dirname(PACKAGE_DIR)                    # .../BackEnd
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)                   # repo root

# The dashboard live-feed JPEGs are written here (served statically by Vite from FrontEnd/public).
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "FrontEnd", "public")

# YOLO person/seg weights — absolute now (was cwd-relative in the monolith). Prefer 26n, fall
# back to 11n. Used both for the (legacy) global model and each CameraThread's own instance.
_YOLO_SEG_26 = os.path.join(BACKEND_DIR, "yolo26n-seg.pt")
_YOLO_SEG_11 = os.path.join(BACKEND_DIR, "yolo11n-seg.pt")
YOLO_SEG_WEIGHTS = _YOLO_SEG_26 if os.path.exists(_YOLO_SEG_26) else _YOLO_SEG_11

DRESSCODE_MODEL_PATH = os.path.join(BACKEND_DIR, "runs", "detect", "dresscode_runs",
                                    "codewatch_dresscode_v3", "weights", "best.pt")

# --- API endpoints ------------------------------------------------------------------------
API_BASE_URL = "http://127.0.0.1:8000/api"
GET_EMBEDDINGS_URL = f"{API_BASE_URL}/get-embeddings/"
LOG_VIOLATION_URL = f"{API_BASE_URL}/log-violation/"
GET_CAMERAS_URL = f"{API_BASE_URL}/cameras/"
GET_BLACKLIST_URL = f"{API_BASE_URL}/blacklist/"
LOG_MOVEMENT_URL = f"{API_BASE_URL}/movement-log/"
CAMERA_HEARTBEAT_URL = f"{API_BASE_URL}/camera-heartbeat/"
REGISTER_UNKNOWN_URL = f"{API_BASE_URL}/register-unknown/"
GET_DRESSCODE_RULES_URL = f"{API_BASE_URL}/dress-code-rules/"

# --- Service authentication ---------------------------------------------------------------
# The API requires authentication. The CV engine authenticates as the dedicated
# 'codewatch-service' account via its DRF token (created by setup_service_token.py, stored in
# BackEnd/.env).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BACKEND_DIR, '.env'))
except Exception:
    pass
SERVICE_API_TOKEN = os.environ.get('SERVICE_API_TOKEN', '')
SERVICE_HEADERS = {"Authorization": f"Token {SERVICE_API_TOKEN}"} if SERVICE_API_TOKEN else {}
if not SERVICE_API_TOKEN:
    print("⚠️  SERVICE_API_TOKEN not set — run 'python setup_service_token.py'. API calls will be rejected (401).")

# --- Tunable parameters -------------------------------------------------------------------
PARAMS = {
    "conf_threshold": 0.5,
    "similarity_threshold": 0.5,
    "log_interval": 30,
    "unknown_time_threshold": 3.0, # seconds before logging unknown
    "violation_cooldown": 30.0, # seconds before logging same unknown again

    # --- Liveness / anti-spoofing (PAD) ---
    # A face match is only trusted once the MiniFASNet PAD model votes the face "live",
    # so a printed photo / phone screen / video replay can't spoof a known identity.
    "liveness_enabled": True,          # master switch for the PAD gate
    "liveness_ensemble": False,        # False = single light model (~3.5ms/face); True = 2-model Silent-Face ensemble
    "liveness_threshold": 0.5,         # min averaged P(real) for a frame to count as live
    "liveness_min_votes": 3,           # PAD reads to collect before deciding (multi-frame vote)
    "liveness_live_ratio": 0.6,        # fraction of votes that must be "live" to accept the match
    "liveness_max_attempts": 12,       # stop sampling after this many frames, then fail-open (accept)
    "liveness_min_face": 50,           # min face bbox edge (px) to trust a PAD read; smaller => abstain
    "liveness_log_violations": True,   # log a "Spoofing Attempt" violation when a spoof is rejected
    "rppg_enabled": False,             # OPTIONAL high-assurance pulse check — off by default, NOT in the hot path
}

# --- Dress-code policy: day-one DEFAULTS / offline fallback -------------------------------
# The policy is ADMIN-EDITABLE and stored in the DB (DressCodeRule); api_client.load_dresscode_policy()
# loads it from the API at startup and the WatcherThread refreshes it. These sets only seed
# runtime_state and act as the offline fallback if the API is unreachable, preserving the
# original hardcoded behaviour.
DEFAULT_COMPLIANT_MALE = {'m-button-down', 'm-formal-trousers', 'm-kurta', 'm-shalwar', 'm-shirts'}
DEFAULT_COMPLIANT_FEMALE = {'w-dress', 'w-dupatta', 'w-eastern-trouser', 'w-kameez', 'w-shalwar'}
DEFAULT_VIOLATION_MALE = {'m-informal-pants', 'm-sleeveless'}
DEFAULT_VIOLATION_FEMALE = {'w-western-shirt', 'w-western-trouser', 'm-sleeveless'}
DEFAULT_NEUTRAL = {'outerwear'}

# Friendly labels for the live overlay (matches the classifications set in add_member).
# ASCII only — OpenCV's font can't render the "·" used in the web UI.
CATEGORY_LABELS = {
    'employee': 'Employee',
    'employee_admin': 'Employee - Admin',
    'employee_ssd': 'Employee - SSD',
    'employee_dept_head': 'Employee - Dept Head',
    'employee_guard': 'Employee - Guard',
    'student': 'Student',
}
