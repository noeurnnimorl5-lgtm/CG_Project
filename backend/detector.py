"""
detector.py — YOLOv8 Face Detection + InsightFace Recognition Pipeline
"""

import io
import json
import numpy as np
from PIL import Image
import cv2

# ─── Lazy-load heavy models ───────────────────────────────────────────────────
_yolo_model = None
_insight_app = None


def get_yolo():
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        # Uses YOLOv8n-face — auto-downloads on first run
        _yolo_model = YOLO("yolov8n-face.pt")
    return _yolo_model


def get_insight():
    global _insight_app
    if _insight_app is None:
        import insightface
        from insightface.app import FaceAnalysis
        _insight_app = FaceAnalysis(
            name="buffalo_sc",          # lightweight model
            providers=["CPUExecutionProvider"]
        )
        _insight_app.prepare(ctx_id=0, det_size=(640, 640))
    return _insight_app


# ─── Utilities ────────────────────────────────────────────────────────────────

def bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def cv2_to_rgb(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


# ─── Detection ────────────────────────────────────────────────────────────────

def detect_faces(image_bytes: bytes) -> list[dict]:
    """
    Run YOLOv8-face on raw image bytes.
    Returns list of dicts: {box: [x1,y1,x2,y2], confidence: float}
    """
    img = bytes_to_cv2(image_bytes)
    model = get_yolo()
    results = model(img, verbose=False)[0]

    faces = []
    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        conf = float(box.conf[0])
        if conf > 0.4:
            faces.append({"box": [x1, y1, x2, y2], "confidence": round(conf, 3)})
    return faces


# ─── Enrollment ───────────────────────────────────────────────────────────────

def extract_embedding(image_bytes: bytes) -> list[float] | None:
    """
    Extract 512-dim face embedding using InsightFace.
    Returns embedding as Python list, or None if no face found.
    """
    img = bytes_to_cv2(image_bytes)
    rgb = cv2_to_rgb(img)
    app = get_insight()
    faces = app.get(rgb)
    if not faces:
        return None
    # Use the largest face if multiple detected
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    return face.embedding.tolist()


# ─── Recognition ──────────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def recognize_face(
    image_bytes: bytes,
    registered_students: list[dict],   # [{id, name, embedding: list[float]}, ...]
    threshold: float = 0.45
) -> dict | None:
    """
    Detect + recognize face in image.
    Returns matched student dict with confidence, or None.
    """
    if not registered_students:
        return None

    img = bytes_to_cv2(image_bytes)
    rgb = cv2_to_rgb(img)
    app = get_insight()
    faces = app.get(rgb)

    if not faces:
        return None

    # Use biggest face
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
    query_emb = face.embedding.tolist()

    best_match = None
    best_score = -1.0

    for student in registered_students:
        if not student.get("embedding"):
            continue
        score = cosine_similarity(query_emb, student["embedding"])
        if score > best_score:
            best_score = score
            best_match = student

    if best_score >= threshold and best_match:
        return {**best_match, "confidence": round(best_score, 3)}
    return None
