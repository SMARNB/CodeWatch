"""Django REST client for the CV engine.

Pulls the identity registry, blacklist, active cameras and the admin-editable dress-code policy
from the API, and writes the results into runtime_state. (The CV engine is an API *consumer* —
there is no web server here, so there are no routes to register.)
"""
import requests
import numpy as np

from . import config
from . import runtime_state as state


def load_registry_and_blacklist():
    with state.state_lock:
        print("📡 Refreshing Registry & Blacklist via API...")
        # Registry
        try:
            response = requests.get(config.GET_EMBEDDINGS_URL, headers=config.SERVICE_HEADERS, timeout=5)
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
                state.global_registry = new_reg
                total_emb = sum(len(f['embeddings']) for f in new_reg)
                print(f"✅ Loaded {len(state.global_registry)} known faces ({total_emb} embeddings).")
        except Exception as e:
            print(f"⚠️ Registry fetch failed: {e}")

        # Blacklist
        try:
            response = requests.get(config.GET_BLACKLIST_URL, headers=config.SERVICE_HEADERS, timeout=5)
            if response.status_code == 200:
                data = response.json()
                new_bl = set()
                for item in data:
                    if 'person_id' in item:
                        new_bl.add(int(item['person_id']))
                    elif 'id' in item:
                        new_bl.add(int(item['id']))
                state.global_blacklist = new_bl
                print(f"✅ Loaded {len(state.global_blacklist)} blacklisted individuals.")
        except Exception as e:
            pass


def load_dresscode_policy():
    """Load the admin-editable dress-code policy (DressCodeRule) from the API and rebuild the
    violation/compliant sets. Mirrors load_registry_and_blacklist(): called once at startup and
    refreshed periodically by the WatcherThread. On any failure the current sets are kept, so a
    transient API hiccup never silently disables dress-code enforcement.

    A rule scoped to gender 'any' applies to both male and female contexts — e.g. 'm-sleeveless'
    (a violation for everyone) seeds as gender='any', reproducing the old hardcoded sets where it
    appeared in both VIOLATION_MALE and VIOLATION_FEMALE.
    """
    try:
        response = requests.get(config.GET_DRESSCODE_RULES_URL, headers=config.SERVICE_HEADERS, timeout=5)
        if response.status_code != 200:
            print(f"⚠️ Dress-code policy fetch HTTP {response.status_code} — keeping current policy.")
            return
        rules = response.json()
        if not rules:
            print("⚠️ Dress-code policy returned empty — keeping current policy.")
            return

        cm, cf, vm, vf, nt = set(), set(), set(), set(), set()
        for r in rules:
            cls = r.get('clothing_class')
            status = r.get('status')
            gender = r.get('gender', 'any')
            if not cls:
                continue
            if status == 'violation':
                if gender in ('male', 'any'):
                    vm.add(cls)
                if gender in ('female', 'any'):
                    vf.add(cls)
            elif status == 'compliant':
                if gender in ('male', 'any'):
                    cm.add(cls)
                if gender in ('female', 'any'):
                    cf.add(cls)
            else:  # neutral (or unknown status) — neither compliant nor a violation
                nt.add(cls)

        with state.dresscode_policy_lock:
            state.COMPLIANT_MALE, state.COMPLIANT_FEMALE = cm, cf
            state.VIOLATION_MALE, state.VIOLATION_FEMALE = vm, vf
            state.NEUTRAL = nt
        print(f"👗 Dress-code policy loaded: {len(vm)} male / {len(vf)} female violation classes "
              f"({len(rules)} rules).")
    except Exception as e:
        print(f"⚠️ Dress-code policy fetch failed ({e}) — keeping current policy.")


def get_cameras():
    try:
        response = requests.get(config.GET_CAMERAS_URL, headers=config.SERVICE_HEADERS, timeout=5)
        if response.status_code == 200:
            return {cam['camera_id']: cam for cam in response.json() if cam.get('is_active', True)}
    except Exception as e:
        print(f"⚠️ Could not fetch cameras: {e}")
    return {}
