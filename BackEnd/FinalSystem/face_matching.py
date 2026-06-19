"""Face identity resolution: cosine similarity against the local registry and the Redis
cross-camera handover cache. Reads shared state via runtime_state so it always sees the latest
registry the WatcherThread loaded.
"""
import json

import numpy as np

from . import config
from . import runtime_state as state


def cosine_similarity(target_emb, db_matrix):
    target = np.array(target_emb, dtype=np.float32).flatten()
    norm_db = np.linalg.norm(db_matrix, axis=1, keepdims=True)
    norm_target = np.linalg.norm(target)
    if norm_target == 0:
        return np.zeros(db_matrix.shape[0])
    sims = np.dot(db_matrix, target) / (norm_db.flatten() * norm_target)
    return sims


def find_match_in_redis(target_emb):
    """Check Redis global_identity keys for existing matches across cameras."""
    try:
        keys = state.redis_client.keys("global_identity:*")
        if not keys:
            return None, 0.0, None

        cached_identities = []
        cached_embeddings = []
        for key in keys:
            val = state.redis_client.get(key)
            if val:
                data = json.loads(val)
                emb = data.get('embedding')
                if emb:  # skip entries cached without an embedding (would make np.array ragged)
                    cached_identities.append((data['id'], data['name']))
                    cached_embeddings.append(emb)

        if cached_embeddings:
            db_matrix = np.array(cached_embeddings)
            sims = cosine_similarity(target_emb, db_matrix)
            best_idx = np.argmax(sims)
            max_score = sims[best_idx]

            if max_score > config.PARAMS["similarity_threshold"]:
                pid, name = cached_identities[best_idx]
                return pid, float(max_score), name
    except Exception as e:
        print(f"Redis match error: {e}")
    return None, 0.0, None


def find_match_in_db(target_emb):
    """Check local DB cache (global_registry); score against each person's BEST embedding."""
    with state.state_lock:
        if not state.global_registry:
            return None, 0.0, "Unknown", "unknown"

        all_rows = []
        owner = []
        for idx, f in enumerate(state.global_registry):
            for emb in f['embeddings']:
                all_rows.append(emb)
                owner.append(idx)

        if not all_rows:
            return None, 0.0, "Unknown", "unknown"

        db_matrix = np.array(all_rows)
        sims = cosine_similarity(target_emb, db_matrix)
        thr = config.PARAMS["similarity_threshold"]

        # Every embedding row scoring above the threshold is a candidate.
        above = [i for i in range(len(sims)) if sims[i] > thr]
        if not above:
            return None, 0.0, "Unknown", "unknown"

        # Prefer a real, named identity over an auto-registered "John Doe" (classification
        # 'unknown'), so a freshly added person wins over their leftover unknown record.
        named = [i for i in above if state.global_registry[owner[i]].get('classification', 'unknown') != 'unknown']
        pool = named if named else above
        best_row = max(pool, key=lambda i: sims[i])
        max_score = float(sims[best_row])
        match = state.global_registry[owner[best_row]]
        return match['id'], max_score, match['name'], match.get('classification', 'unknown')

    return None, 0.0, "Unknown", "unknown"
