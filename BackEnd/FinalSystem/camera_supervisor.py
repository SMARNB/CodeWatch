"""WatcherThread — the supervisor.

Periodically refreshes the identity registry, blacklist and dress-code policy, spawns a
CameraThread for every new or crashed camera, and tracks the Redis "spotlight" person id that
the dashboard uses to highlight one individual across cameras.
"""
import os
import glob
import time
import threading

from . import config
from . import runtime_state as state
from . import api_client
from .surveillance_tracker import CameraThread


class WatcherThread(threading.Thread):
    def __init__(self):
        super().__init__()
        self.running = True
        self.last_highlight_person_id = None

    def run(self):
        print("👁️ Watcher Thread started.")
        while self.running:
            api_client.load_registry_and_blacklist()
            api_client.load_dresscode_policy()

            if state.highlight_person_id != self.last_highlight_person_id:
                try:
                    old_files = glob.glob(os.path.join(config.OUTPUT_DIR, "live_feed_track_*.jpg"))
                    for f in old_files:
                        os.remove(f)
                except Exception as e:
                    print(f"Error cleaning up old track frames: {e}")
                self.last_highlight_person_id = state.highlight_person_id

            cameras = api_client.get_cameras()
            for cid, cdata in cameras.items():
                if cid not in state.active_camera_threads or not state.active_camera_threads[cid].is_alive():
                    print(f"🎥 Detected new or crashed camera: {cid}. Starting thread.")
                    t = CameraThread(cdata)
                    state.active_camera_threads[cid] = t
                    t.start()

            for _ in range(30):
                if not self.running: break
                try:
                    val = state.redis_client.get("track_highlight")
                    state.highlight_person_id = int(val) if val else None
                except Exception:
                    pass
                time.sleep(2)
