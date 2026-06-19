"""CameraThread — the per-camera surveillance pipeline.

One thread per active camera: open the stream, run YOLO person detection, DeepSort tracking,
InsightFace identity resolution, the MiniFASNet liveness gate, dress-code classification, then
log violations/movements and write the annotated dashboard frame. Shared state is reached via
runtime_state; the AI models via model_loader.
"""
import os
import time
import json
import threading
from collections import deque

import cv2
import requests
from deep_sort_realtime.deepsort_tracker import DeepSort

from . import config
from . import runtime_state as state
from . import model_loader as models
from . import face_matching
from . import image_utils


class CameraThread(threading.Thread):
    def __init__(self, camera_data):
        super().__init__()
        self.camera_data = camera_data
        self.camera_id = camera_data['camera_id']
        self.name = camera_data['name']
        self.stream_url = camera_data['stream_url']
        self.running = True

        print(f"[{self.camera_id}] Initializing YOLO & DeepSort...")
        self.model = models.new_yolo_seg()
        self.tracker = DeepSort(max_age=30, n_init=3)
        self.unknown_track_timers = {}
        self.pending_registrations = {}  # {track_id: person_id}
        self.registration_in_progress = set()
        self.save_counter = 0
        self.fps_history = deque(maxlen=10)
        self.cap = None
        self.last_frame_ts = time.time()
        self.STALL_TIMEOUT = 10  # seconds with no frame ⇒ read() is wedged (USB drop); reset capture

        # Dashboard frame path. Vite's dev server serves /live_feed_<camera_id>.jpg
        # case-sensitively, but Windows' filesystem is case-insensitive: if a stale
        # file differing only in case already exists (e.g. live_feed_cam1.jpg from an
        # old run), cv2.imwrite reuses that dir entry and keeps its old-case name, so
        # the browser request for live_feed_Cam1.jpg never matches. Purge any such
        # case-variant once at startup so the file is (re)created with the exact case.
        self.out_path = os.path.join(config.OUTPUT_DIR, f"live_feed_{self.camera_id}.jpg")
        self._purge_case_variants(self.out_path)

    def _purge_case_variants(self, path):
        folder, target = os.path.dirname(path), os.path.basename(path)
        try:
            for existing in os.listdir(folder):
                if existing.lower() == target.lower() and existing != target:
                    try:
                        os.remove(os.path.join(folder, existing))
                        print(f"[{self.camera_id}] Removed stale case-variant feed file: {existing}")
                    except OSError:
                        pass
        except OSError:
            pass

    def async_post(self, url, data):
        threading.Thread(target=lambda: requests.post(url, json=data, headers=config.SERVICE_HEADERS, timeout=2), daemon=True).start()

    def _check_liveness(self, track, face_img, face_bbox):
        """Per-track presentation-attack check with a multi-frame vote.

        Returns 'live' | 'spoof' | 'pending'. The verdict is cached on the track once decided
        (once-per-track), so PAD stops running afterwards. `face_bbox` is (x1,y1,x2,y2) in
        `face_img`'s coordinates — i.e. the InsightFace bbox on the same crop we embedded.
        """
        ls = getattr(track, 'liveness', None)
        if ls is None:
            ls = {'scores': [], 'live': 0, 'attempts': 0, 'decided': False, 'is_live': True, 'score': -1.0}
            track.liveness = ls
        if ls['decided']:
            return 'live' if ls['is_live'] else 'spoof'

        ls['attempts'] += 1
        if face_img is not None and face_bbox is not None:
            res = models.liveness_detector.analyze(face_img, face_bbox)
            if res.valid:
                ls['scores'].append(res.real_prob)
                if res.is_live:
                    ls['live'] += 1

        n = len(ls['scores'])
        if n >= config.PARAMS.get("liveness_min_votes", 3) or ls['attempts'] >= config.PARAMS.get("liveness_max_attempts", 12):
            if n == 0:
                # Never got a usable read (face too small/far the whole time) -> fail open.
                ls['is_live'], ls['score'] = True, -1.0
            else:
                ls['is_live'] = (ls['live'] / n) >= config.PARAMS.get("liveness_live_ratio", 0.6)
                ls['score'] = float(sum(ls['scores']) / n)
            ls['decided'] = True
            return 'live' if ls['is_live'] else 'spoof'
        return 'pending'

    def _log_spoof(self, track_id, snapshot_img):
        """Flag a rejected spoof: console + (optionally) a 'Spoofing Attempt' violation, cooldowned."""
        now = time.time()
        key = (self.camera_id, track_id, "spoof")
        if (now - state.violation_last_logged.get(key, 0)) <= config.PARAMS["violation_cooldown"]:
            return
        state.violation_last_logged[key] = now
        print(f"🛑 SPOOF/PRESENTATION-ATTACK rejected on {self.camera_id} (track {track_id}) — match not trusted")
        if config.PARAMS.get("liveness_log_violations", True):
            snap_b64 = image_utils.numpy_to_base64(snapshot_img) if (snapshot_img is not None and snapshot_img.size > 0) else ""
            self.async_post(config.LOG_VIOLATION_URL, {
                "person_id": None,
                "type": "Spoofing Attempt (Liveness)",
                "conf": 0.0,
                "snapshot": snap_b64,
                "camera_id": self.camera_id,
            })

    def register_unknown_async(self, track_id, embedding, snapshot, camera_id):
        if track_id in self.registration_in_progress:
            return
        self.registration_in_progress.add(track_id)
        def do_register():
            try:
                resp = requests.post(config.REGISTER_UNKNOWN_URL, json={
                    "embedding": embedding,
                    "snapshot": snapshot,
                    "camera_id": camera_id
                }, headers=config.SERVICE_HEADERS, timeout=3)
                if resp.status_code == 200 or resp.status_code == 201:
                    data = resp.json()
                    self.pending_registrations[track_id] = {
                        "id": data.get("person_id"),
                        "name": data.get("name", "Unknown"),
                        "is_known": data.get("is_known", False),
                        "classification": data.get("classification", "unknown"),
                    }
            except Exception as e:
                print(f"Registration failed: {e}")
            finally:
                self.registration_in_progress.discard(track_id)
        threading.Thread(target=do_register, daemon=True).start()

    def _resolve_webcam_index(self, requested):
        # DirectShow device indices are unstable while the OBS Virtual Camera is registered:
        # it can occupy index 0 or 1 between runs and only ever emits a standby logo, never
        # the real webcam. Resolve to the physical camera by NAME, skipping any OBS/virtual
        # device. pygrabber enumerates devices in the same order cv2.CAP_DSHOW uses. Falls
        # back to the requested index if enumeration is unavailable.
        try:
            from pygrabber.dshow_graph import FilterGraph
            names = FilterGraph().get_input_devices()
        except Exception:
            return requested
        physical = [i for i, n in enumerate(names)
                    if 'obs' not in n.lower() and 'virtual' not in n.lower()]
        if not physical:
            return requested
        chosen = requested if requested in physical else physical[0]
        label = names[chosen] if chosen < len(names) else '?'
        if chosen != requested:
            was = names[requested] if requested < len(names) else 'n/a'
            print(f"[{self.camera_id}] Webcam index {requested} ('{was}') isn't a physical camera; using index {chosen} ('{label}').")
        else:
            print(f"[{self.camera_id}] Using webcam index {chosen} ('{label}').")
        return chosen

    def _open_capture(self):
        # Webcam → integer index (resolved to the physical camera by name); RTSP/NVR/MediaMTX → URL via FFmpeg (TCP forced at top of file).
        if str(self.stream_url).isdigit():
            idx = self._resolve_webcam_index(int(self.stream_url))
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            return cap
        return cv2.VideoCapture(self.stream_url, cv2.CAP_FFMPEG)

    def _stamp_heartbeat(self):
        # Tell the backend this camera is alive right now, at most once every 5s.
        now = time.time()
        if now - getattr(self, '_last_heartbeat_post', 0) < 5:
            return
        self._last_heartbeat_post = now
        try:
            self.async_post(config.CAMERA_HEARTBEAT_URL, {"camera_id": self.camera_id})
        except Exception:
            pass

    def force_stop(self):
        # Stop the thread AND release the capture so a cap.read() wedged on a dropped USB camera
        # unblocks immediately — otherwise self.running=False alone never takes effect and the
        # shutdown join() hangs forever.
        self.running = False
        try:
            if self.cap is not None:
                self.cap.release()
        except Exception:
            pass

    def _stall_watchdog(self):
        # cap.read() on a DSHOW webcam BLOCKS (never returns) if the USB device drops mid-stream, so
        # the main loop can't notice and the supervisor still sees the thread as alive. Watch the
        # last-frame timestamp from this side thread; if it goes stale, release the capture to unblock
        # the wedged read() so the loop's own reopen path can recover.
        while self.running:
            time.sleep(2)
            if not self.running or self.cap is None:
                continue
            if time.time() - self.last_frame_ts > self.STALL_TIMEOUT:
                print(f"⚠️ [{self.camera_id}] No frames for {self.STALL_TIMEOUT}s — resetting capture (camera may have dropped).")
                self.last_frame_ts = time.time()  # give the reopen a chance before firing again
                try:
                    self.cap.release()
                except Exception:
                    pass

    def run(self):
        print(f"🚀 Camera {self.name} ({self.camera_id}) connected at {self.stream_url}")

        # Webcam index vs RTSP/NVR/MediaMTX URL — see _open_capture (RTSP forced over TCP).
        cap = self._open_capture()
        self.cap = cap
        self.last_frame_ts = time.time()
        threading.Thread(target=self._stall_watchdog, daemon=True).start()
        frame_count = 0
        frame_skip = 3 if self.camera_id in ["CAM-002", "CAM-003"] else 1
        read_failures = 0
        # A freshly (re)opened DSHOW webcam needs a moment before it delivers frames — its
        # first reads come back empty. Tolerate a short burst of empty reads (warm-up, or a
        # transient hiccup) before declaring the feed dropped; otherwise that very first
        # warm-up miss triggers an endless release → 5s sleep → reopen loop that never lets
        # the camera spin up.
        WARMUP_GRACE = 80  # ~4s of empty reads at 0.05s per poll

        while self.running:
            success, frame = cap.read()
            if not success or frame is None:
                if not self.running:
                    break
                read_failures += 1
                if read_failures < WARMUP_GRACE:
                    time.sleep(0.05)
                    continue
                print(f"🔄 [{self.camera_id}] Video feed dropped, retrying in 5 seconds...")
                cap.release()
                time.sleep(5)
                cap = self._open_capture()
                self.cap = cap
                self.last_frame_ts = time.time()
                read_failures = 0
                continue
            read_failures = 0
            self.last_frame_ts = time.time()

            frame_count += 1
            self._stamp_heartbeat()
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

            results = self.model(frame, conf=config.PARAMS["conf_threshold"], classes=0, verbose=False)
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
                state.track_histories[self.camera_id][track_id].append((center_x, center_y))

                # Optimization: Track-then-identify
                needs_insightface = False
                if not hasattr(track, 'identity'):
                    needs_insightface = True
                    track.frames_since_check = 0
                elif not track.identity.get('confirmed'):
                    needs_insightface = True
                elif track.identity.get('name') == "Unknown" or track.identity.get('classification', 'unknown') == 'unknown':
                    # Also re-check auto-registered "John Doe" tracks, so they upgrade to a
                    # real identity once that person has been added/promoted in the system.
                    if not hasattr(track, 'frames_since_check'):
                        track.frames_since_check = 0
                    track.frames_since_check += 1
                    if track.frames_since_check > 30:
                        needs_insightface = True
                        track.frames_since_check = 0

                current_emb = None
                current_face_img = None    # the exact image PAD should run on (matched orientation)
                current_face_bbox = None   # InsightFace bbox (x1,y1,x2,y2) within current_face_img
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
                        def _emb_from(img):
                            # Returns (embedding_list, face_bbox_xyxy) for the largest face, or
                            # (None, None). The bbox lets the liveness gate crop the same face we embed.
                            with state.insightface_lock:
                                fs = models.app.get(img)
                            if not fs:
                                return None, None
                            fs.sort(key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
                            return fs[0].embedding.tolist(), fs[0].bbox

                        # Upright first.
                        current_emb, current_face_bbox = _emb_from(person_crop)
                        if current_emb is not None:
                            current_face_img = person_crop

                        # If the upright crop doesn't match a known person, retry rotated copies —
                        # handles upside-down / sideways captures that would otherwise become a new "John Doe".
                        matched_known = False
                        if current_emb is not None:
                            _pid, _s, _n, _c = face_matching.find_match_in_db(current_emb)
                            matched_known = bool(_pid and _c != 'unknown')
                        if not matched_known:
                            for _rot in (cv2.ROTATE_180, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE):
                                _rimg = cv2.rotate(person_crop, _rot)
                                _emb, _bbox = _emb_from(_rimg)
                                if _emb is None:
                                    continue
                                if current_emb is None:
                                    current_emb = _emb
                                    current_face_bbox = _bbox
                                    current_face_img = _rimg
                                _pid, _s, _n, _c = face_matching.find_match_in_db(_emb)
                                if _pid and _c != 'unknown':
                                    current_emb = _emb   # this orientation matched a known person — use it
                                    current_face_bbox = _bbox
                                    current_face_img = _rimg
                                    break

                # Identity Resolution
                matched_name = "Unknown"
                matched_id = None
                matched_classification = "unknown"

                if current_emb is not None:
                    # Check the full DB registry (knows each person's classification) AND the
                    # Redis handover cache. Prefer a REAL named identity from the DB so that the
                    # moment a person is added/promoted they stop resolving to their old
                    # auto-registered "John Doe" record — even if that record still matches.
                    db_pid, db_score, db_name, db_class = face_matching.find_match_in_db(current_emb)
                    r_pid, r_score, r_name = face_matching.find_match_in_redis(current_emb)

                    if db_pid and db_class != 'unknown':
                        if not hasattr(track, 'identity') or track.identity.get('id') != db_pid:
                            print(f"🟢 {self.camera_id}: Identified {db_name} (score: {db_score:.2f})")
                        track.identity = {"id": db_pid, "name": db_name, "confirmed": True, "classification": db_class}
                        matched_name = db_name
                        matched_id = db_pid
                        matched_classification = db_class
                    elif r_pid:
                        if not hasattr(track, 'identity') or track.identity.get('id') != r_pid:
                            print(f"🤝 HANDOVER: {r_name} moved to {self.camera_id}")
                        track.identity = {"id": r_pid, "name": r_name, "confirmed": True, "classification": "known"}
                        matched_name = r_name
                        matched_id = r_pid
                        matched_classification = "known"
                    elif db_pid:
                        track.identity = {"id": db_pid, "name": db_name, "confirmed": True, "classification": db_class}
                        matched_name = db_name
                        matched_id = db_pid
                        matched_classification = db_class



                elif hasattr(track, 'identity'):
                    matched_name = track.identity.get("name", "Unknown")
                    matched_id = track.identity.get("id")
                    matched_classification = track.identity.get("classification", "unknown")

                # --- Liveness / anti-spoofing gate -----------------------------------------------
                # A printed photo / phone screen / replay can fool face matching, so a match is only
                # trusted once MiniFASNet PAD votes the face "live". The verdict is cached per track
                # (once-per-track) via a multi-frame vote, carried across frames on
                # track.identity['classification']: "verifying" => still voting (identity held, no
                # logging); "spoof" => rejected. A live verdict leaves the resolved identity intact.
                is_spoof = (matched_classification == "spoof")
                verifying = (matched_classification == "verifying")
                if models.liveness_detector is not None and matched_id is not None and current_emb is not None and not is_spoof:
                    ls_state = self._check_liveness(track, current_face_img, current_face_bbox)
                    if ls_state == 'spoof':
                        is_spoof, verifying = True, False
                        track.identity = {"id": None, "name": "SPOOF", "confirmed": True, "classification": "spoof"}
                        self._log_spoof(track_id, current_face_img)
                    elif ls_state == 'pending':
                        verifying = True
                        # confirmed=False keeps InsightFace (and thus PAD) running until we decide.
                        track.identity = {"id": matched_id, "name": matched_name, "confirmed": False, "classification": "verifying"}
                    else:
                        verifying = False  # 'live' — keep the resolved (already-confirmed) identity
                # Neutralise the identity while verifying or if spoofed, so no movement / violation /
                # handover logging fires for an unverified or fake face. matched_name is kept during
                # verification only for the on-screen "Verifying..." label.
                if is_spoof:
                    matched_name, matched_id, matched_classification = "SPOOF", None, "spoof"
                elif verifying:
                    matched_id, matched_classification = None, "verifying"

                # Only refresh the cross-camera identity cache when we actually computed an embedding
                # this frame. Caching an empty list poisons find_match_in_redis (it builds a ragged
                # np.array that raises and silently returns no match), breaking handover. When there's
                # no fresh embedding we just leave the previous good cache entry (30s TTL) in place.
                if matched_id and matched_name != "Unknown" and current_emb:
                    try:
                        redis_data = json.dumps({
                            "camera_id": self.camera_id,
                            "track_id": track_id,
                            "last_seen_timestamp": time.time(),
                            "name": matched_name,
                            "id": matched_id,
                            "embedding": current_emb,
                            "confidence": 1.0
                        })
                        state.redis_client.setex(f"global_identity:{matched_id}", 30, redis_data)
                    except Exception as e:
                        print(f"Redis write error: {e}")

                # Movement Logging Tracker
                track_identifier = matched_id if matched_id else f"unknown_{track_id}"
                if self.camera_id not in state.camera_active_persons:
                    state.camera_active_persons[self.camera_id] = {}

                if track_identifier not in state.camera_active_persons[self.camera_id]:
                    # Only log movement for a real, DB-backed identity. Unidentified tracks use a
                    # synthetic "unknown_<track_id>" id that isn't a TrackedPerson PK, so the
                    # log_movement view's TrackedPerson.objects.get(id=...) would raise and return
                    # 400. Such tracks are logged later (under their real id) once auto-registration
                    # resolves them.
                    if matched_id:
                        self.async_post(config.LOG_MOVEMENT_URL, {
                            "person_id": matched_id,
                            "camera_id": self.camera_id,
                            "action": "enter"
                        })

                state.camera_active_persons[self.camera_id][track_identifier] = time.time()

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

                if models.dresscode_model and track_crop.size > 0 and not skip_dresscode and not is_spoof and not verifying:
                    dc_results = models.dresscode_model(track_crop, conf=0.5, verbose=False)
                    for r in dc_results:
                        for box in r.boxes:
                            cls_id = int(box.cls[0].item())
                            cls_name = models.dresscode_model.names[cls_id]
                            detected_clothes.append(cls_name)

                    if detected_clothes:
                        m_count = sum(1 for c in detected_clothes if c.startswith('m-'))
                        w_count = sum(1 for c in detected_clothes if c.startswith('w-'))

                        gender = 'male' if m_count >= w_count else 'female'

                        if gender == 'male':
                            violation_classes = [c for c in detected_clothes if c in state.VIOLATION_MALE]
                        else:
                            violation_classes = [c for c in detected_clothes if c in state.VIOLATION_FEMALE]

                        if violation_classes:
                            is_violation = True
                            is_compliant = False

                        if is_violation:
                            now = time.time()
                            dc_key = (self.camera_id, track_id, "dresscode")
                            last_logged = state.violation_last_logged.get(dc_key, 0)
                            if (now - last_logged) > config.PARAMS["violation_cooldown"]:
                                state.violation_last_logged[dc_key] = now
                                print(f"DRESS CODE VIOLATION: {matched_name} on {self.camera_id} - detected {violation_classes}")
                                snap_b64 = image_utils.numpy_to_base64(track_crop)
                                log_data = {
                                    "person_id": matched_id if matched_name != "Unknown" else None,
                                    "type": f"Dress Code Violation ({', '.join(violation_classes)})",
                                    "conf": 1.0,
                                    "snapshot": snap_b64,
                                    "camera_id": self.camera_id
                                }
                                self.async_post(config.LOG_VIOLATION_URL, log_data)

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
                            snap_b64 = image_utils.numpy_to_base64(track_crop) if track_crop.size > 0 else ""
                            u_data = json.dumps({
                                "first_seen": first_seen,
                                "last_seen": now,
                                "embedding": current_emb,
                                "snapshot_base64": snap_b64
                            })
                            state.redis_client.setex(f"unknown:{self.camera_id}:{track_id}", 300, u_data)
                        except Exception as e:
                            pass

                    # Unauthorized access: register first (independent of cooldown), then act on the result.
                    if duration > config.PARAMS["unknown_time_threshold"]:
                        snap_b64 = image_utils.numpy_to_base64(track_crop) if track_crop.size > 0 else ""

                        # Kick off auto-registration once per track (the server rate-limits per camera).
                        if current_emb and not getattr(track, 'registered', False) and track_id not in self.pending_registrations:
                            self.register_unknown_async(track_id, current_emb, snap_b64, self.camera_id)

                        # Once the backend returns an identity, act on it.
                        if track_id in self.pending_registrations:
                            reg = self.pending_registrations.pop(track_id)
                            person_id = reg["id"]
                            name = reg["name"]
                            is_known = reg.get("is_known", False)
                            classification = reg.get("classification", "unknown")
                            track.identity = {"id": person_id, "name": name, "confirmed": True, "classification": classification}
                            track.registered = True
                            matched_id = person_id
                            matched_name = name
                            matched_classification = classification

                            try:
                                redis_data = json.dumps({
                                    "camera_id": self.camera_id,
                                    "track_id": track_id,
                                    "last_seen_timestamp": time.time(),
                                    "name": name,
                                    "id": person_id,
                                    "embedding": current_emb,
                                    "confidence": 1.0 if is_known else 0.0
                                })
                                state.redis_client.setex(f"global_identity:{person_id}", 30, redis_data)
                            except Exception as e:
                                pass

                            # Only a genuinely-new unknown is an Unauthorized Access violation.
                            # A backend "known" match = a registered person the live matcher just missed — don't flag them.
                            if not is_known:
                                last_logged = state.violation_last_logged.get((self.camera_id, track_id), 0)
                                if (now - last_logged) > config.PARAMS["violation_cooldown"]:
                                    state.violation_last_logged[(self.camera_id, track_id)] = now
                                    print(f"🚨 VIOLATION: Unauthorized person on {self.camera_id} → {name}")
                                    self.async_post(config.LOG_VIOLATION_URL, {
                                        "person_id": person_id,
                                        "type": "Unauthorized Access",
                                        "conf": 0.0,
                                        "snapshot": snap_b64,
                                        "camera_id": self.camera_id
                                    })
                            else:
                                print(f"✅ Recovered identity on {self.camera_id}: {name} (was about to be flagged unknown)")

                            self.async_post(config.LOG_MOVEMENT_URL, {
                                "person_id": person_id,
                                "camera_id": self.camera_id,
                                "action": "enter"
                            })

                            if self.camera_id not in state.camera_active_persons:
                                state.camera_active_persons[self.camera_id] = {}
                            state.camera_active_persons[self.camera_id][person_id] = time.time()
                else:
                    if track_id in self.unknown_track_timers:
                        del self.unknown_track_timers[track_id]

                    with state.state_lock:
                        if matched_id in state.global_blacklist:
                            now = time.time()
                            last_logged = state.violation_last_logged.get((self.camera_id, track_id), 0)
                            if (now - last_logged) > config.PARAMS["violation_cooldown"]:
                                print(f"🚨 VIOLATION: Blacklisted Person Detected on {self.camera_id} ({matched_name})")
                                state.violation_last_logged[(self.camera_id, track_id)] = now
                                snap_b64 = image_utils.numpy_to_base64(track_crop) if track_crop.size > 0 else ""
                                log_data = {
                                    "person_id": matched_id,
                                    "type": "Blacklisted Person Detected",
                                    "conf": 1.0,
                                    "snapshot": snap_b64,
                                    "camera_id": self.camera_id
                                }
                                self.async_post(config.LOG_VIOLATION_URL, log_data)

                # Visualization
                color = (0, 0, 255) # Red
                label = "UNKNOWN"
                trail_color = (0, 0, 255) # Red
                thickness = 2

                if is_spoof:
                    color = (0, 0, 255)              # Red
                    label = "!! SPOOF / FAKE FACE !!"
                    trail_color = (0, 0, 255)
                    thickness = 3
                elif verifying:
                    color = (0, 180, 255)            # Amber
                    label = f"Verifying liveness... {matched_name}"
                    trail_color = (0, 180, 255)
                elif matched_name != "Unknown":
                    with state.state_lock:
                        if matched_id in state.global_blacklist:
                            color = (128, 0, 128) # Purple
                            label = f"BLACKLISTED: {matched_name}"
                            trail_color = (128, 0, 128) # Purple
                        elif matched_classification == 'visitor' or "visitor" in matched_name.lower():
                            color = (255, 200, 0) # Cyan/Blue
                            label = f"VISITOR: {matched_name}"
                            trail_color = (255, 200, 0) # Cyan/Blue
                        else:
                            color = (0, 255, 0) # Green
                            cat = config.CATEGORY_LABELS.get(matched_classification)
                            label = f"{matched_name} ({cat})" if cat else matched_name
                            trail_color = (0, 255, 0) # Green
                            if is_violation:
                                trail_color = (0, 165, 255) # Orange

                if state.highlight_person_id and state.highlight_person_id == matched_id:
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

                pts = list(state.track_histories[self.camera_id][track_id])
                for i in range(1, len(pts)):
                    line_thickness = 3 if (state.highlight_person_id and state.highlight_person_id == matched_id) else max(1, int(2 * (i / len(pts))))
                    cv2.line(frame, pts[i-1], pts[i], trail_color, line_thickness)

                if state.highlight_person_id and state.highlight_person_id == matched_id:
                    tracking_frame = clean_frame.copy()
                    overlay = tracking_frame.copy()
                    cv2.rectangle(overlay, (0,0), (tracking_frame.shape[1], tracking_frame.shape[0]), (0,0,0), -1)
                    tracking_frame = cv2.addWeighted(overlay, 0.5, tracking_frame, 0.5, 0)

                    cv2.rectangle(tracking_frame, (x1, y1), (x2, y2), (0, 255, 255), 3)
                    cv2.putText(tracking_frame, f"TRACKING: {matched_name}", (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 3)

                    for i in range(1, len(pts)):
                        cv2.line(tracking_frame, pts[i-1], pts[i], (0, 255, 255), max(1, int(2 * (i / len(pts)))))

                    tracking_frame_to_save = tracking_frame
                    tracking_frame_path = os.path.join(config.OUTPUT_DIR, f"live_feed_track_{matched_id}.jpg")

                    try:
                        state.redis_client.setex(f"track_camera:{matched_id}", 30, self.camera_id)
                    except:
                        pass

            # Cleanup inactive persons
            now = time.time()
            if self.camera_id in state.camera_active_persons:
                to_remove = []
                for pid, last_seen in state.camera_active_persons[self.camera_id].items():
                    if now - last_seen > 5.0:
                        # Skip synthetic "unknown_<track_id>" ids — they were never logged on enter
                        # (no DB row), so an exit POST would only 400. Real ids log normally.
                        if not str(pid).startswith("unknown_"):
                            self.async_post(config.LOG_MOVEMENT_URL, {
                                "person_id": pid,
                                "camera_id": self.camera_id,
                                "action": "exit"
                            })
                        to_remove.append(pid)
                for pid in to_remove:
                    del state.camera_active_persons[self.camera_id][pid]

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
                try:
                    cv2.imwrite(self.out_path, frame)
                except:
                    pass

        cap.release()
        print(f"🛑 Thread {self.camera_id} stopped.")
