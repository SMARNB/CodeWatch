"""Shared, cross-thread runtime state for the CodeWatch CV engine.

In the monolith these were module globals mutated via the ``global`` keyword. Split across
modules, that no longer works — so all mutable shared state lives here and every module reaches
it by namespace (``import ... runtime_state as state`` then ``state.global_registry``). Anything
that gets *rebound* at runtime (registry, blacklist, the dress-code sets, the highlight id) MUST
be accessed as ``state.X`` so readers always see the latest binding; the infra objects below
(locks, redis client) are created once and never rebound.
"""
import threading
from collections import defaultdict, deque

import redis

from . import config

# --- Cross-camera infrastructure (created once, never rebound) ---
redis_client = redis.Redis(host='localhost', port=6379, db=1, decode_responses=True)
insightface_lock = threading.Lock()
state_lock = threading.Lock()
dresscode_policy_lock = threading.Lock()

# --- Identity registry & blacklist (REBOUND by api_client.load_registry_and_blacklist) ---
global_registry = []      # list of {'id': int, 'name': str, 'embeddings': [np.array], 'classification': str}
global_blacklist = set()  # set of blacklisted DB ids

# --- Live dress-code policy (seeded from config defaults; REBOUND by load_dresscode_policy) ---
COMPLIANT_MALE = set(config.DEFAULT_COMPLIANT_MALE)
COMPLIANT_FEMALE = set(config.DEFAULT_COMPLIANT_FEMALE)
VIOLATION_MALE = set(config.DEFAULT_VIOLATION_MALE)
VIOLATION_FEMALE = set(config.DEFAULT_VIOLATION_FEMALE)
NEUTRAL = set(config.DEFAULT_NEUTRAL)

# --- Tracking / highlight / logging state ---
highlight_person_id = None                   # REBOUND by the WatcherThread (Redis spotlight)
camera_active_persons = {}                    # {camera_id: {person_id: last_seen_ts}} (mutated in place)
violation_last_logged = {}                    # {(camera_id, track_id[, kind]): ts} (mutated in place)
track_histories = defaultdict(lambda: defaultdict(lambda: deque(maxlen=50)))  # {cam: {track_id: deque[(x,y)]}}
active_camera_threads = {}                    # {camera_id: CameraThread} (mutated in place)
