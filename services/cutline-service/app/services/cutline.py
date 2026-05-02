"""Génération de ligne de coupe (kiss cut) façon prettygoodstickers.com.

Stratégie : dilatation unique = la marge demandée. Le contour suit
fidèlement la silhouette du design, avec une marge constante autour.

1. Décodage de l'image (PNG/JPG/WEBP) en RGBA
2. Resize vers une grille d'analyse avec PADDING transparent
3. Seuillage du canal alpha → masque binaire
4. (optionnel) Petite ouverture pour nettoyer les pixels isolés
5. **Dilatation par `offset_px`** (= seul élargissement)
6. `cv2.findContours` avec RETR_EXTERNAL → contours externes
7. Filtrage des micro-fragments
8. Simplification très légère + lissage 1 passe
9. Conversion en SVG path (multi-M si plusieurs régions disjointes)

Le résultat est en coordonnées **pixels d'image originale**.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Literal

import cv2
import numpy as np
from PIL import Image


# ─── Result types ─────────────────────────────────────────────────────────────


@dataclass
class CutlineSuccess:
    ok: Literal[True]
    svg_path: str
    width_px: int
    height_px: int
    point_count: int
    contour_count: int
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
    grid_size: int = 320,
    close_radius: int = 0,
    denoise: bool = True,
    simplify_epsilon_factor: float = 0.0008,
    smooth_passes: int = 1,
    min_area_ratio: float = 0.0008,
) -> CutlineOutcome:
    """Génère un SVG path en coordonnées **pixels d'image originale**.

    Args:
        image_bytes: PNG/JPG/WEBP bytes
        offset_px: marge de coupe en pixels d'image originale (0 = collé au pixel opaque)
        grid_size: résolution de la grille d'analyse interne (320 = bon compromis)
        close_radius: fermeture morphologique optionnelle pour fusionner des éléments
            distants (0 par défaut — laissez la dilatation par offset faire le job)
        denoise: applique une petite ouverture pour éliminer les pixels isolés
        simplify_epsilon_factor: tolérance Douglas-Peucker (% du périmètre)
        smooth_passes: passes de lissage cyclique (1 par défaut, conserve les détails)
        min_area_ratio: contours plus petits que `min_area_ratio * inner²` ignorés
    """
    # ─── 1. Décoder ─────────────────────────────────────────────────────────
    try:
        with Image.open(BytesIO(image_bytes)) as pil:
            pil = pil.convert("RGBA")
            orig_w, orig_h = pil.size
            arr = np.array(pil)
    except Exception:  # noqa: BLE001
        return CutlineFailure(ok=False, error="load_failed", message="Impossible de charger l'image.")

    if orig_w < 8 or orig_h < 8:
        return CutlineFailure(ok=False, error="no_contour", message="Image trop petite.")

    has_transparency = bool((arr[:, :, 3] < 250).any())

    # ─── 2. Resize sur grille avec padding ─────────────────────────────────
    # Pad assez grand pour absorber dilatations sans débordement
    inner = grid_size
    pad = max(close_radius, _grid_offset(offset_px, orig_w, orig_h, inner)) + 8
    canvas_size = inner + 2 * pad

    pil_small = Image.fromarray(arr).resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(pil_small, (pad, pad), pil_small)
    alpha = np.array(canvas)[:, :, 3]

    # ─── 3. Masque binaire ──────────────────────────────────────────────────
    _, mask = cv2.threshold(alpha, 15, 255, cv2.THRESH_BINARY)

    opaque = int((mask > 0).sum())
    inner_area = inner * inner
    if opaque / inner_area > 0.96:
        return CutlineFailure(
            ok=False,
            error="no_transparency",
            message="Votre image n'a pas de fond transparent. Utilisez un PNG avec canal alpha.",
        )
    if opaque < 16:
        return CutlineFailure(ok=False, error="no_contour", message="Image trop peu opaque.")

    # ─── 4. Denoise (ouverture légère, conserve la forme) ──────────────────
    if denoise:
        open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, open_kernel)

    # ─── 5. (Optionnel) fermeture morpho explicite si l'utilisateur veut ───
    if close_radius > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (close_radius * 2 + 1, close_radius * 2 + 1),
        )
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # ─── 6. Dilatation par offset (= seul élargissement de la silhouette) ──
    offset_grid = _grid_offset(offset_px, orig_w, orig_h, inner)
    if offset_grid > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (offset_grid * 2 + 1, offset_grid * 2 + 1),
        )
        mask = cv2.dilate(mask, kernel)

    # ─── 7. Contours externes ───────────────────────────────────────────────
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return CutlineFailure(ok=False, error="no_contour", message="Aucun contour détecté.")

    # Filtrer les fragments
    min_area = max(32, min_area_ratio * inner_area)
    contours = [c for c in contours if cv2.contourArea(c) >= min_area]
    if not contours:
        return CutlineFailure(ok=False, error="no_contour", message="Contours trop petits.")

    # Si un contour domine massivement (>= 88% de l'aire totale), on ne garde
    # que celui-là (évite des micro-cutlines parasites). Sinon multi-contour.
    total = sum(cv2.contourArea(c) for c in contours)
    biggest = max(contours, key=cv2.contourArea)
    if total > 0 and cv2.contourArea(biggest) / total >= 0.88:
        contours = [biggest]

    # ─── 8. Pour chaque contour : simplification + lissage + unpad + rescale ─
    sx = orig_w / inner
    sy = orig_h / inner
    processed: list[np.ndarray] = []
    for contour in contours:
        perimeter = cv2.arcLength(contour, closed=True)
        epsilon = max(0.5, simplify_epsilon_factor * perimeter)
        simplified = cv2.approxPolyDP(contour, epsilon, closed=True).reshape(-1, 2).astype(np.float64)

        if smooth_passes > 0 and len(simplified) > 4:
            simplified = _smooth_cyclic(simplified, smooth_passes)

        # Unpad + rescale vers pixels image originale
        pts = np.empty_like(simplified)
        pts[:, 0] = (simplified[:, 0] - pad) * sx
        pts[:, 1] = (simplified[:, 1] - pad) * sy

        # Clamp léger pour éviter coordonnées extrêmes
        margin = max(orig_w, orig_h) * 0.5
        pts[:, 0] = np.clip(pts[:, 0], -margin, orig_w + margin)
        pts[:, 1] = np.clip(pts[:, 1], -margin, orig_h + margin)
        processed.append(pts)

    # ─── 9. SVG path multi-M ────────────────────────────────────────────────
    svg_path = _to_svg_path_multi(processed)
    total_pts = sum(len(p) for p in processed)

    return CutlineSuccess(
        ok=True,
        svg_path=svg_path,
        width_px=orig_w,
        height_px=orig_h,
        point_count=total_pts,
        contour_count=len(processed),
        has_transparency=has_transparency,
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _grid_offset(offset_px: int, orig_w: int, orig_h: int, inner: int) -> int:
    """Convertit un offset en pixels d'image originale vers la grille d'analyse."""
    if offset_px <= 0:
        return 0
    scale = inner / max(orig_w, orig_h)
    return max(1, int(round(offset_px * scale)))


def _smooth_cyclic(pts: np.ndarray, passes: int) -> np.ndarray:
    """Moyenne mobile cyclique [0.25, 0.5, 0.25]. Conserve la forme."""
    cur = pts
    for _ in range(passes):
        prev = np.roll(cur, 1, axis=0)
        nxt = np.roll(cur, -1, axis=0)
        cur = 0.25 * prev + 0.5 * cur + 0.25 * nxt
    return cur


def _to_svg_path_multi(contours: list[np.ndarray]) -> str:
    parts: list[str] = []
    for pts in contours:
        if len(pts) == 0:
            continue
        sub = []
        for i, (x, y) in enumerate(pts):
            sub.append(f"{'M' if i == 0 else 'L'}{x:.1f},{y:.1f}")
        sub.append("Z")
        parts.append(" ".join(sub))
    return " ".join(parts)
