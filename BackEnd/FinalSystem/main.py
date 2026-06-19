"""Orchestrator / entry point for the CodeWatch CV engine.

Run from the BackEnd/ directory:

    python -m FinalSystem.main

Holds no heavy logic — it imports the modules (which load the AI models), seeds the registry /
blacklist / dress-code policy, starts the WatcherThread, then idles until Ctrl-C and shuts down
cleanly.
"""
import time

from . import config            # noqa: F401  (sets env, paths, service token at import)
from . import model_loader      # noqa: F401  (loads YOLO + InsightFace + liveness once)
from . import runtime_state as state
from . import api_client
from .camera_supervisor import WatcherThread


def main():
    print("====================================")
    print("🛡️ Multi-Camera tracking system starting...")
    print("====================================")

    api_client.load_registry_and_blacklist()
    api_client.load_dresscode_policy()

    watcher = WatcherThread()
    watcher.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Graceful Shutdown Initiated...")
        watcher.running = False
        for cid, t in state.active_camera_threads.items():
            t.force_stop()   # releases the capture so a wedged read() unblocks instead of hanging join()

        watcher.join(timeout=5)
        for cid, t in state.active_camera_threads.items():
            t.join(timeout=5)

        try:
            state.redis_client.close()
        except Exception:
            pass
        print("✅ Shutdown complete.")


if __name__ == "__main__":
    main()
