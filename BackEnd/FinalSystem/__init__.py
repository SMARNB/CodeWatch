"""CodeWatch CV engine — modular FinalSystem package.

The former monolithic ``BackEnd/FinalSystem.py`` was split, by domain, into:

    config.py              constants, paths, API URLs, params, service auth
    runtime_state.py       shared cross-thread state, locks, redis client
    model_loader.py        loads YOLO + InsightFace + liveness once (shared)
    face_matching.py       cosine similarity + DB/Redis identity resolution
    image_utils.py         small image helpers (jpeg -> base64)
    api_client.py          Django REST I/O (registry, blacklist, cameras, dress-code policy)
    surveillance_tracker.py  CameraThread — the per-camera detect/track/recognise pipeline
    camera_supervisor.py   WatcherThread — refreshes state and spawns camera threads
    main.py                orchestrator / entry point

Run it with:  ``python -m FinalSystem.main``  (from the BackEnd/ directory).

This ``__init__`` intentionally stays light (no heavy imports) so ``import FinalSystem`` is
cheap; the AI models load only when ``model_loader`` is imported (by ``main``).
"""

__all__ = []
