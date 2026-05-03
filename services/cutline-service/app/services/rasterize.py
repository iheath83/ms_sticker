"""Rasterisation de fichiers vectoriels et binaires non supportés nativement
par les navigateurs (PDF, AI, EPS, PSD). Le résultat est un PNG RGBA aplati
utilisé comme aperçu visuel dans l'éditeur côté client.

Le fichier original reste conservé côté commande pour la production —
seul l'aperçu est rasterisé pour permettre la prévisualisation, le
positionnement et le calcul de la ligne de coupe.
"""
from __future__ import annotations

import logging
from io import BytesIO
from typing import Final

from PIL import Image

log = logging.getLogger(__name__)

SUPPORTED_EXTS: Final[frozenset[str]] = frozenset({"pdf", "ai", "eps", "psd"})

# Limite de la longueur du plus long côté de l'aperçu rasterisé.
# Au-delà, on resize pour limiter le poids transmis au navigateur tout en
# conservant assez de détail pour la cutline (300 dpi suffisent pour la
# détection de contours).
MAX_DIMENSION_PX: Final[int] = 3000


def _normalize_size(image: Image.Image) -> Image.Image:
    """Redimensionne si l'image dépasse MAX_DIMENSION_PX sur le plus grand côté."""
    longest = max(image.size)
    if longest <= MAX_DIMENSION_PX:
        return image
    ratio = MAX_DIMENSION_PX / float(longest)
    new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
    return image.resize(new_size, Image.Resampling.LANCZOS)


def _rasterize_pdf_or_ai(data: bytes, dpi: int) -> Image.Image:
    """PDF ou AI (qui est généralement un PDF déguisé) → première page raster."""
    # Import paresseux : poppler-utils requis dans le Dockerfile.
    from pdf2image import convert_from_bytes  # type: ignore

    pages = convert_from_bytes(
        data,
        dpi=dpi,
        first_page=1,
        last_page=1,
        fmt="png",
        transparent=True,
    )
    if not pages:
        raise ValueError("empty_pdf_no_pages")
    return pages[0].convert("RGBA")


def _rasterize_eps(data: bytes, dpi: int) -> Image.Image:
    """EPS via Pillow + Ghostscript. Le scale est exprimé en multiples de 72 dpi."""
    img = Image.open(BytesIO(data))
    # Pillow EPS lit avec un scale entier ; on calcule depuis le DPI cible.
    scale = max(1, int(round(dpi / 72)))
    try:
        img.load(scale=scale)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"eps_load_failed: {exc}") from exc
    return img.convert("RGBA")


def _rasterize_psd(data: bytes) -> Image.Image:
    """PSD via Pillow natif (PsdImagePlugin) → composite RGBA aplati."""
    img = Image.open(BytesIO(data))
    return img.convert("RGBA")


def rasterize_to_png(data: bytes, ext: str, dpi: int = 200) -> bytes:
    """Rasterise un fichier non supporté nativement vers un PNG RGBA.

    Args:
        data: octets du fichier source.
        ext: extension sans le point (pdf / ai / eps / psd).
        dpi: résolution cible pour PDF/AI/EPS (PSD ignore — taille originale).

    Returns:
        bytes PNG (RGBA).

    Raises:
        ValueError si le format n'est pas supporté ou si la lecture échoue.
    """
    ext_clean = ext.lower().lstrip(".")
    if ext_clean not in SUPPORTED_EXTS:
        raise ValueError(f"unsupported_format: {ext_clean}")

    if ext_clean in ("pdf", "ai"):
        image = _rasterize_pdf_or_ai(data, dpi=dpi)
    elif ext_clean == "eps":
        image = _rasterize_eps(data, dpi=dpi)
    else:  # psd
        image = _rasterize_psd(data)

    image = _normalize_size(image)

    out = BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()
