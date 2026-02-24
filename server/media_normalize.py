"""
image_normalizer.py
────────────────────────────────────────────────────────────────────────────────
Pre-processes photos before they are sent to GPT-4o vision.

Pipeline per image
──────────────────
1. Decode base64 → numpy array
2. Resize to a fixed square (TARGET_SIZE) with letterboxing (no distortion)
3. CLAHE on the L-channel (LAB) → adaptive contrast / lighting normalisation
4. Non-local means denoising → remove sensor / compression noise
5. Unsharp mask → recover fine details lost in denoising
6. Re-encode as JPEG

Composite
─────────
make_comparison_image() stitches the two processed frames side-by-side with an
orange divider and text labels so GPT-4o can compare them in a single prompt.

Dependencies
────────────
    pip install opencv-python-headless numpy --break-system-packages
"""

import base64
import io
import logging
from typing import Tuple

import cv2
import numpy as np

log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

TARGET_SIZE: int = 512          # each panel is 512 × 512 px
JPEG_QUALITY: int = 88
CLAHE_CLIP: float = 2.0         # clip limit for CLAHE (higher = more contrast boost)
CLAHE_GRID: Tuple[int, int] = (8, 8)
DENOISE_H: int = 8              # filter strength for luminance channel
UNSHARP_AMOUNT: float = 0.6     # blend factor for unsharp mask (0 = off, 1 = full)
UNSHARP_KERNEL: Tuple[int, int] = (0, 0)
UNSHARP_SIGMA: float = 1.2


# ── Low-level helpers ─────────────────────────────────────────────────────────

def _decode_b64(b64_str: str) -> np.ndarray:
    """Base64 string → BGR numpy array."""
    raw = base64.b64decode(b64_str)
    buf = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image from base64 data.")
    return img


def _encode_jpeg(img: np.ndarray) -> Tuple[str, str]:
    """BGR numpy array → (base64 string, mime_type)."""
    ok, buf = cv2.imencode(
        ".jpg",
        img,
        [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY],
    )
    if not ok:
        raise RuntimeError("JPEG encoding failed.")
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    return b64, "image/jpeg"


def _letterbox(img: np.ndarray, size: int) -> np.ndarray:
    """
    Resize to (size × size) with black padding — preserves aspect ratio.
    Avoids stretching that would distort posture/hand proportions.
    """
    h, w = img.shape[:2]
    scale = size / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    canvas = np.zeros((size, size, 3), dtype=np.uint8)
    y_off = (size - new_h) // 2
    x_off = (size - new_w) // 2
    canvas[y_off : y_off + new_h, x_off : x_off + new_w] = resized
    return canvas


def _apply_clahe(img: np.ndarray) -> np.ndarray:
    """
    CLAHE (Contrast Limited Adaptive Histogram Equalisation) on the L channel.
    Corrects uneven / poor lighting without blowing out highlights.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_GRID)
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def _denoise(img: np.ndarray) -> np.ndarray:
    """
    Non-local means denoising — removes JPEG artefacts and sensor noise.
    Works on the full colour image; h controls strength.
    """
    return cv2.fastNlMeansDenoisingColored(
        img,
        None,
        h=DENOISE_H,
        hColor=DENOISE_H,
        templateWindowSize=7,
        searchWindowSize=21,
    )


def _unsharp_mask(img: np.ndarray) -> np.ndarray:
    """
    Unsharp mask — recovers fine detail lost in denoising.
    blended = original + amount * (original - blurred)
    """
    blurred = cv2.GaussianBlur(img, UNSHARP_KERNEL, UNSHARP_SIGMA)
    sharpened = cv2.addWeighted(img, 1 + UNSHARP_AMOUNT, blurred, -UNSHARP_AMOUNT, 0)
    return sharpened


# ── Public API ────────────────────────────────────────────────────────────────

def normalize_image(b64_str: str) -> Tuple[str, str]:
    """
    Full normalisation pipeline for a single photo.

    Args:
        b64_str: Base64-encoded photo (any common format).

    Returns:
        (b64_normalised, "image/jpeg")

    Raises:
        ValueError: if the image cannot be decoded.
        RuntimeError: if encoding fails.
    """
    img = _decode_b64(b64_str)
    img = _letterbox(img, TARGET_SIZE)
    img = _apply_clahe(img)
    img = _denoise(img)
    img = _unsharp_mask(img)
    return _encode_jpeg(img)


def make_comparison_image(
    user_b64: str,
    reference_b64: str,
    user_label: str = "УЧЕНИК",
    ref_label: str = "РЕФЕРЕНЦИЯ",
) -> Tuple[str, str]:
    """
    Normalise both images and stitch them side-by-side with an orange divider.

    Sending one composite image to GPT-4o (rather than two separate images)
    allows the model to compare them spatially in a single context window, which
    produces more accurate comparative feedback and costs ~half the vision tokens.

    Args:
        user_b64:      Base64 of the student's photo.
        reference_b64: Base64 of the reference photo.
        user_label:    Text label overlaid on the left panel.
        ref_label:     Text label overlaid on the right panel.

    Returns:
        (b64_composite, "image/jpeg")
    """
    # Normalise both panels independently
    user_b64_norm, _ = normalize_image(user_b64)
    ref_b64_norm, _ = normalize_image(reference_b64)

    user_img = _decode_b64(user_b64_norm)
    ref_img = _decode_b64(ref_b64_norm)

    # Orange divider (4 px wide)
    divider = np.zeros((TARGET_SIZE, 4, 3), dtype=np.uint8)
    divider[:] = (0, 100, 255)  # BGR → orange

    composite = np.hstack([user_img, divider, ref_img])

    # ── Overlay labels ──────────────────────────────────────────────────────
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.65
    thickness = 2
    pad = 10

    def _put_label(canvas: np.ndarray, text: str, x: int) -> None:
        (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
        # semi-transparent dark background for readability
        x1, y1 = x + pad, pad
        x2, y2 = x + pad + tw + 8, pad + th + baseline + 6
        overlay = canvas.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.55, canvas, 0.45, 0, canvas)
        cv2.putText(
            canvas,
            text,
            (x1 + 4, y2 - baseline - 2),
            font,
            font_scale,
            (0, 140, 255),   # orange text
            thickness,
            cv2.LINE_AA,
        )

    _put_label(composite, user_label, 0)
    _put_label(composite, ref_label, TARGET_SIZE + 4)   # +4 for divider

    return _encode_jpeg(composite)