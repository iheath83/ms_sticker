"""Suppression de fond via rembg (modèle IS-Net / U²-Net ONNX)."""
from __future__ import annotations

import logging
from io import BytesIO

from PIL import Image
from rembg import new_session, remove

log = logging.getLogger(__name__)

_session = None
_session_name: str | None = None


def warmup_rembg(model_name: str) -> None:
    """À appeler au démarrage pour charger le modèle ONNX en mémoire."""
    global _session, _session_name
    _session = new_session(model_name)
    _session_name = model_name


def remove_background(image_bytes: bytes) -> bytes:
    """Renvoie un PNG avec fond transparent."""
    if _session is None:
        raise RuntimeError("rembg session not initialized — call warmup_rembg() first")

    output_bytes = remove(image_bytes, session=_session)
    if isinstance(output_bytes, Image.Image):
        # Cas où rembg renvoie un objet PIL au lieu de bytes
        buf = BytesIO()
        output_bytes.save(buf, format="PNG")
        output_bytes = buf.getvalue()
    elif not isinstance(output_bytes, (bytes, bytearray)):
        raise RuntimeError(f"Unexpected rembg output type: {type(output_bytes)}")
    return bytes(output_bytes)
