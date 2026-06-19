"""Small image helpers for the CV engine."""
import base64

import cv2


def numpy_to_base64(img):
    """JPEG-encode a BGR numpy frame and return it as a base64 string (for API snapshots)."""
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')
