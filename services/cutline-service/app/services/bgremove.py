"""Suppression de fond via rembg (modèle IS-Net / U²-Net ONNX).

Le warmup est tolérant : si rembg crash (modèle absent, OOM, etc.), le
service reste up et les appels échoueront proprement avec un 503.
La session est créée lazy au premier appel si le warmup n'a pas tourné.
"""
from __future__ import annotations

import logging
import threading
from io import BytesIO

from PIL import Image
from rembg import new_session, remove

log = logging.getLogger(__name__)

_session = None
_session_name: str | None = None
_lock = threading.Lock()


def warmup_rembg(model_name: str) -> bool:
    """Charge le modèle en mémoire au démarrage. Retourne False si échec."""
    global _session, _session_name
    try:
        with _lock:
            log.info("Loading rembg model %s…", model_name)
            _session = new_session(model_name)
            _session_name = model_name
            log.info("rembg model %s ready", model_name)
            return True
    except Exception as exc:  # noqa: BLE001
        log.exception("rembg warmup failed: %s", exc)
        return False


def is_ready() -> bool:
    return _session is not None


def remove_background(image_bytes: bytes, model_name: str = "isnet-general-use") -> bytes:
    """Renvoie un PNG avec fond transparent.

    Si la session n'est pas chargée, tente une init lazy.
    """
    global _session, _session_name
    if _session is None:
        with _lock:
            if _session is None:
                log.warning("rembg lazy-init triggered (warmup did not run)")
                _session = new_session(model_name)
                _session_name = model_name

    output = remove(image_bytes, session=_session)
    if isinstance(output, Image.Image):
        buf = BytesIO()
        output.save(buf, format="PNG")
        return buf.getvalue()
    if isinstance(output, (bytes, bytearray)):
        return bytes(output)
    raise RuntimeError(f"Unexpected rembg output type: {type(output)}")
