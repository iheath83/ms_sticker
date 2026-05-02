"""Endpoint de génération de ligne de coupe."""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.services.cutline import (
    CutlineFailure,
    CutlineSuccess,
    generate_cutline,
)
from app.settings import settings

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/cutline")
async def cutline_endpoint(
    file: Annotated[UploadFile, File(description="Image PNG/JPG/WEBP")],
    # Offset peut être donné soit en pixels d'image originale (préféré),
    # soit en mm + DPI. Si offset_px est fourni, il a la priorité.
    offset_px: Annotated[int | None, Form(ge=0, le=2000)] = None,
    offset_mm: Annotated[float, Form(ge=0, le=20)] = 2.0,
    dpi: Annotated[int, Form(ge=72, le=2400)] = 300,
    # Avancés (rarement utilisés côté front)
    grid_size: Annotated[int, Form(ge=64, le=1024)] = 320,
    close_radius_px: Annotated[int, Form(ge=0, le=64)] = 0,
    smooth_passes: Annotated[int, Form(ge=0, le=12)] = 1,
) -> dict:
    if file.size and file.size > settings.max_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"file_too_large (max {settings.max_image_bytes // (1024*1024)} MB)",
        )

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid_content_type (expected image/*)",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file")

    if offset_px is None:
        # Fallback : convertir mm → px d'image originale via DPI
        offset_px = int(round(offset_mm * dpi / 25.4))

    outcome = generate_cutline(
        image_bytes,
        offset_px=offset_px,
        grid_size=grid_size,
        close_radius=close_radius_px,
        smooth_passes=smooth_passes,
    )

    if isinstance(outcome, CutlineSuccess):
        return {
            "ok": True,
            "result": {
                "svg_path": outcome.svg_path,
                "width_px": outcome.width_px,
                "height_px": outcome.height_px,
                "point_count": outcome.point_count,
                "contour_count": outcome.contour_count,
                "has_transparency": outcome.has_transparency,
                "offset_px": offset_px,
            },
        }

    assert isinstance(outcome, CutlineFailure)
    return {
        "ok": False,
        "error": outcome.error,
        "message": outcome.message,
    }
