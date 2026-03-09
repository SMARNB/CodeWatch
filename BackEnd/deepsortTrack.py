import cv2
import numpy as np
import os
import pickle
from deep_sort_realtime.deepsort_tracker import DeepSort
from glob import glob
from logger import logIt


TRACK_CLASSES = {
    'ObjectA': {
        'color': (19, 69, 139),
        'class_id': 0,
        'tracker_params': {'max_age': 10, 'n_init': 2, 'nms_max_overlap': 0.99, 'max_cosine_distance': 0.8},
        'filter': lambda w, h: h > 250
    },
    'ObjectB': {
        'color': (255, 0, 0),
        'class_id': 1,
        'tracker_params': {'max_age': 3, 'n_init': 3, 'nms_max_overlap': 0.9, 'max_cosine_distance': 0.9},
        'filter': lambda w, h: w * h > 100 and w > 10 and h > 10
    },
    'ObjectC': {
        'color': (128, 128, 0),
        'class_id': 2,
        'tracker_params': {'max_age': 3, 'n_init': 3, 'nms_max_overlap': 0.9, 'max_cosine_distance': 0.8},
        'filter': lambda w, h: w > 10 and h > 10 and w * h > 350
    },
    'ObjectD': {
        'color': (0, 165, 255),
        'class_id': 3,
        'tracker_params': {'max_age': 3, 'n_init': 3, 'nms_max_overlap': 0.9, 'max_cosine_distance': 0.8},
        'filter': lambda w, h: w * h > 500 and w > 10 and h > 10
    },
    'ObjectE': {
        'color': (200, 150, 200),
        'class_id': 4,
        'tracker_params': {'max_age': 3, 'n_init': 3, 'nms_max_overlap': 0.9, 'max_cosine_distance': 0.8},
        'filter': lambda w, h: w * h > 300
    },
    'ObjectF': {
        'color': (0, 128, 128),
        'class_id': 5,
        'tracker_params': {'max_age': 3, 'n_init': 1, 'nms_max_overlap': 0.9, 'max_cosine_distance': 0.8},
        'filter': lambda w, h: w * h > 300 and w > 5 and h > 5
    },
    'ObjectG': {
        'color': (120, 120, 120),
        'class_id': 6,
        'tracker_params': {'max_age': 3, 'n_init': 1, 'nms_max_overlap': 0.9, 'max_cosine_distance': 0.8},
        'filter': lambda w, h: w * h > 300 and w > 5 and h > 5
    }
}

COLOR_TOLERANCE = 20


# =====================================================
# Standard IOU
# =====================================================
def compute_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou


# =====================================================
# Detection Extraction (Color-based)
# =====================================================
def get_boxes(frame, class_name, img_width, img_height):
    config = TRACK_CLASSES.get(class_name, {})
    if not config:
        return []
    
    color = config['color']
    class_id = config['class_id']
    filter_func = config['filter']

    lower = np.array([max(0, c - COLOR_TOLERANCE) for c in color])
    upper = np.array([min(255, c + COLOR_TOLERANCE) for c in color])

    mask = cv2.inRange(frame, lower, upper)

    # Morphology (generic anonymized logic)
    if class_name == 'ObjectA':
        for ksize in [(2, 8), (3, 15), (4, 25)]:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, ksize)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    elif class_name in ['ObjectD', 'ObjectE']:
        mask = cv2.morphologyEx(mask, np.ones((9, 9), np.uint8), cv2.MORPH_CLOSE)
    elif class_name in ['ObjectF', 'ObjectG']:
        mask = cv2.morphologyEx(mask, np.ones((11, 11), np.uint8), cv2.MORPH_CLOSE)
    else:
        mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = cv2.contourArea(cnt)

        if class_name == "ObjectF":
            if area > 300:
                bbox = [x, y, w, h]
                boxes.append(([x, y, x + w, y + h], 1.0, class_id, area))

        elif filter_func(w, h):
            boxes.append(([x, y, x + w, y + h], 1.0, class_id, area))

    return boxes


# =====================================================
# GPS Helper (unchanged)
# =====================================================
def calculate_average_gps(image_files, last_idx, gps_data):
    indices = [last_idx]
    if last_idx - 1 >= 0:
        indices.append(last_idx - 1)
    if last_idx + 1 < len(image_files):
        indices.append(last_idx + 1)

    gps_values = []
    for idx in indices:
        image_name = os.path.basename(image_files[idx])
        gps = gps_data.get(os.path.splitext(image_name)[0], None)
        if gps and len(gps) == 2 and all(isinstance(v, (int, float)) for v in gps):
            gps_values.append(gps)

    if gps_values:
        return np.mean(gps_values, axis=0).tolist()
    return None


# =====================================================
# Tracker Persistence
# =====================================================
def load_deepsort_if_exists(base_path, name):
    if not os.path.exists(base_path):
        return None

    pkl_file = os.path.join(base_path, f"trackers_{name}.pkl")
    if not os.path.exists(pkl_file):
        return None

    try:
        with open(pkl_file, 'rb') as f:
            return pickle.load(f)
    except:
        return None


def save_deepsort_tracker(tracker, base_path, name):
    os.makedirs(base_path, exist_ok=True)
    pkl_file = os.path.join(base_path, f"trackers_{name}.pkl")
    try:
        with open(pkl_file, 'wb') as f:
            pickle.dump(tracker, f)
    except:
        pass


# =====================================================
# Remove Very Short Tracks
# =====================================================
def clean_short_tracks(results, min_length=1):
    cleaned = {}
    for key, value in results.items():
        first_frame = value.get("first_frame")
        last_frame = value.get("last_frame")

        try:
            f_idx = int(os.path.splitext(first_frame)[0].split("_")[-1])
            l_idx = int(os.path.splitext(last_frame)[0].split("_")[-1])
            frame_diff = abs(l_idx - f_idx)
        except:
            frame_diff = 0

        if frame_diff < min_length:
            continue

        cleaned[key] = value
    return cleaned


# =====================================================
# MAIN TRACKING PIPELINE
# =====================================================
def track_assets(input_folder, tracker_base_path, output_folder, gps_data=None):

    images = sorted(glob(os.path.join(input_folder, "*.png")) + glob(os.path.join(input_folder, "*.jpg")))
    if not images:
        return {}

    trackers = {}

    # Only tracking ObjectA in this version (same logic, but anonymous)
    tracker_mapping = {
        'trackerA': ['ObjectA']
    }

    for name, class_list in tracker_mapping.items():
        cname = class_list[0]
        tracker = load_deepsort_if_exists(tracker_base_path, name)
        if tracker is None:
            trackers[name] = DeepSort(embedder="mobilenet", bgr=True, **TRACK_CLASSES[cname]['tracker_params'])
        else:
            trackers[name] = tracker

    results = {}
    last_det_idx = {}
    bbox_history = {}

    for i, img_path in enumerate(images):
        frame = cv2.imread(img_path)
        if frame is None:
            continue

        image_name = os.path.basename(img_path)
        h, w = frame.shape[:2]

        all_boxes = []
        for cname in TRACK_CLASSES:
            all_boxes.extend(get_boxes(frame, cname, w, h))

        boxes_by_tracker = {
            'trackerA': [(bbox, score, cid) for bbox, score, cid, _ in all_boxes if cid == 0]
        }

        tracks_by_tracker = {
            name: trackers[name].update_tracks(box_list, frame=frame)
            for name, box_list in boxes_by_tracker.items()
        }

        seen_ids = set()

        for tname, tracks in tracks_by_tracker.items():
            used_boxes = []

            for tr in tracks:
                if not tr.is_confirmed():
                    continue

                tbbox = tr.to_ltrb()
                obj_id = int(tr.track_id)
                class_id = int(tr.get_det_class())

                cname = next(k for k, v in TRACK_CLASSES.items() if v['class_id'] == class_id)
                key = f"{class_id}_{obj_id}_{cname}"

                best_iou = -1
                best_bbox = None
                best_area = None

                if tr.time_since_update == 0:
                    for bbox, _, det_cid, area in all_boxes:
                        if det_cid != class_id:
                            continue
                        if bbox in used_boxes:
                            continue

                        iou = compute_iou(bbox, tbbox)
                        if iou > best_iou:
                            best_iou = iou
                            best_bbox = bbox
                            best_area = area

                    if best_bbox is None:
                        continue

                    used_boxes.append(best_bbox)
                    x1, y1, x2, y2 = best_bbox
                    bbox_xywh = [x1, y1, x2 - x1, y2 - y1]

                    bbox_history.setdefault(key, {})[image_name] = bbox_xywh

                    if key not in results:
                        results[key] = {
                            'class_name': cname,
                            'first_frame': image_name,
                            'last_frame': image_name,
                            'last_idx': i,
                            'bboxes': {image_name: bbox_xywh},
                            'areas': {image_name: best_area},
                            'gps': None
                        }
                    else:
                        results[key]['last_frame'] = image_name
                        results[key]['last_idx'] = i
                        results[key]['bboxes'][image_name] = bbox_xywh
                        results[key]['areas'][image_name] = best_area

                    seen_ids.add(key)
                    last_det_idx[key] = i

        for key in list(last_det_idx.keys()):
            if key not in seen_ids:
                last_idx = last_det_idx[key]
                correct_idx = max(0, last_idx - 5)

                results[key]['last_frame'] = os.path.basename(images[correct_idx])
                results[key]['last_idx'] = correct_idx

                if key in bbox_history:
                    frames = list(bbox_history[key].keys())
                    if frames:
                        recent = max(frames, key=lambda x: int(x.split('.')[0]))
                        results[key]['last_bbox'] = bbox_history[key][recent]
                        results[key]['last_area'] = results[key]['areas'][recent]
                    else:
                        results[key]['last_bbox'] = None
                        results[key]['last_area'] = None

                if gps_data:
                    results[key]['gps'] = calculate_average_gps(images, correct_idx, gps_data)

                del last_det_idx[key]

    for name in trackers:
        save_deepsort_tracker(trackers[name], output_folder, name)

    results = clean_short_tracks(results, min_length=2)
    return results
