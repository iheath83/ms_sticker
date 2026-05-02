"""Génération de ligne de coupe (kiss cut) via OpenCV.

Pipeline robuste, beaucoup plus fiable que mon implémentation TS custom :

1. Décodage de l'image (PNG/JPG/WEBP) avec préservation du canal alpha
2. Resize vers une grille d'analyse (default 220×220) avec PADDING transparent
3. Extraction du masque alpha → seuillage binaire
4. Fermeture morphologique elliptique (`cv2.morphologyEx`) — fusionne les
   parties disjointes du design (logo + texte etc.)
5. `cv2.findContours` avec `RETR_EXTERNAL` → garantit le contour externe
6. Sélection du plus grand contour
7. `cv2.approxPolyDP` (Douglas-Peucker) → simplification
8. Lissage par moyenne mobile
9. Offset polygonal (dilatation supplémentaire si offset > 0)
10. Conversion vers SVG path (M…L…Z)

Le résultat est en coordonnées normalisées 0..1, libre au client de scaler
selon ses besoins (mm, px, etc.).
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Literal

import cv2
import numpy as np
from PIL import Image


# ─── Result / Error types ─────────────────────────────────────────────────────


@dataclass
class CutlineSuccess:
    ok: Literal[True]
    svg_path: str
    width_px: int
    height_px: int
    point_count: int
    has_transparency: bool


@dataclass
class CutlineFailure:
    ok: Literal[False]
    error: str
    message: str


CutlineOutcome = CutlineSuccess | CutlineFailure


# ─── Public API ───────────────────────────────────────────────────────────────


def generate_cutline(
    image_bytes: bytes,
    *,
    offset_px: int = 0,
    grid_size: int = 220,
    close_radius: int = 8,
    pad: int = 14,
    simplify_epsilon_factor: float = 0.0015,
    smooth_passes: int = 5,
) -> CutlineOutcome:
    """Génère un SVG path en coordonnées 0..width × 0..height en pixels d'image originale.

    `offset_px` est en pixels de l'image originale (le caller doit convertir
    depuis mm si besoin).
    """
    # ─── 1. Décoder l'image et extraire l'alpha ─────────────────────────────
    try:
        with Image.open(BytesIO(image_bytes)) as pil:
            pil = pil.convert("RGBA")
            orig_w, orig_h = pil.size
            arr = np.array(pil)
    except Exception:  # noqa: BLE001
        return CutlineFailure(
            ok=False,
            error="load_failed",
            message="Impossible de charger l'image.",
        )

    if orig_w < 8 or orig_h < 8:
        return CutlineFailure(ok=False, error="no_contour", message="Image trop petite.")

    alpha_full = arr[:, :, 3]
    has_transparency = bool((alpha_full < 250).any())

    # ─── 2. Resize sur grille d'analyse avec padding transparent ────────────
    inner = grid_size
    canvas_size = inner + 2 * pad

    # Resize vers (inner × inner) en gardant l'aspect ratio du carré "fit"
    pil_small = Image.fromarray(arr).resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(pil_small, (pad, pad), pil_small)
    arr_small = np.array(canvas)
    alpha = arr_small[:, :, 3]

    # ─── 3. Masque binaire ───────────────────────────────────────────────────
    _, mask = cv2.threshold(alpha, 15, 255, cv2.THRESH_BINARY)

    opaque_count = int((mask > 0).sum())
    inner_area = inner * inner
    if opaque_count / inner_area > 0.96:
        return CutlineFailure(
            ok=False,
            error="no_transparency",
            message="Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha.",
        )
    if opaque_count < 16:
        return CutlineFailure(
            ok=False,
            error="no_contour",
            message="Image trop peu opaque.",
        )

    # ─── 4. Fermeture morphologique : bridge les parties disjointes ─────────
    if close_radius > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (close_radius * 2 + 1, close_radius * 2 + 1),
        )
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # ─── 5. Offset polygonal via dilatation supplémentaire ─────────────────
    if offset_px > 0:
        # Convertir offset_px (image originale) → offset_grid (grille)
        scale = inner / max(orig_w, orig_h)
        offset_grid = max(1, int(round(offset_px * scale)))
        if offset_grid > 0:
            offset_kernel = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE,
                (offset_grid * 2 + 1, offset_grid * 2 + 1),
            )
            mask = cv2.dilate(mask, offset_kernel)

    # ─── 6. Trouver le contour extérieur ─────────────────────────────────────
    # Le padding garantit que le contour externe est fermé et bien identifié.
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return CutlineFailure(
            ok=False,
            error="no_contour",
            message="Aucun contour détecté.",
        )

    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < 32:
        return CutlineFailure(
            ok=False,
            error="no_contour",
            message="Contour trop petit.",
        )

    # ─── 7. Simplification Douglas-Peucker ──────────────────────────────────
    perimeter = cv2.arcLength(contour, closed=True)
    epsilon = max(0.5, simplify_epsilon_factor * perimeter)
    contour = cv2.approxPolyDP(contour, epsilon, closed=True)

    # Aplatir [(N,1,2)] → [(N,2)]
    pts = contour.reshape(-1, 2).astype(np.float64)

    # ─── 8. Lissage (moyenne mobile cyclique) ──────────────────────────────
    if smooth_passes > 0 and len(pts) > 4:
        pts = _smooth_cyclic(pts, smooth_passes)

    # ─── 9. Conversion grille → coordonnées image originale ────────────────
    # Retirer le padding et rescaler vers (orig_w, orig_h)
    pts_img = np.empty_like(pts)
    pts_img[:, 0] = (pts[:, 0] - pad) * (orig_w / inner)
    pts_img[:, 1] = (pts[:, 1] - pad) * (orig_h / inner)

    # Clamper dans les limites (on autorise un léger débord pour l'offset)
    margin = max(orig_w, orig_h) * 0.2
    pts_img[:, 0] = np.clip(pts_img[:, 0], -margin, orig_w + margin)
    pts_img[:, 1] = np.clip(pts_img[:, 1], -margin, orig_h + margin)

    # ─── 10. SVG path ────────────────────────────────────────────────────────
    svg_path = _to_svg_path(pts_img)

    return CutlineSuccess(
        ok=True,
        svg_path=svg_path,
        width_px=orig_w,
        height_px=orig_h,
        point_count=len(pts_img),
        has_transparency=has_transparency,
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _smooth_cyclic(pts: np.ndarray, passes: int) -> np.ndarray:
    """Moyenne mobile cyclique [0.25, 0.5, 0.25] sur N passes."""
    cur = pts
    for _ in range(passes):
        prev = np.roll(cur, 1, axis=0)
        nxt = np.roll(cur, -1, axis=0)
        cur = 0.25 * prev + 0.5 * cur + 0.25 * nxt
    return cur


def _to_svg_path(pts: np.ndarray) -> str:
    if len(pts) == 0:
        return ""
    parts = []
    for i, (x, y) in enumerate(pts):
        cmd = "M" if i == 0 else "L"
        parts.append(f"{cmd}{x:.1f},{y:.1f}")
    return " ".join(parts) + " Z"
