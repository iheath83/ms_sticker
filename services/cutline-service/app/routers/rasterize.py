"""Endpoint de rasterisation : transforme PDF/AI/EPS/PSD en PNG d'aperçu.

Le PNG retourné est utilisé par l'éditeur frontal pour afficher l'image dans
le canvas Konva et calculer la ligne de coupe alpha. Le fichier original
reste séparé côté commande (production print)."""
from __future__ import annotations

import logging
import pathlib
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.services.rasterize import SUPPORTED_EXTS, rasterize_to_png
from app.settings import settings

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/preview/rasterize")
async def rasterize_endpoint(
    file: Annotated[UploadFile, File(description="Fichier PDF/AI/EPS/PSD")],
    dpi: Annotated[int, Form(ge=72, le=600)] = 200,
) -> Response:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="missing_filename",
        )

    ext = pathlib.Path(file.filename).suffix.lower().lstrip(".")
    if ext not in SUPPORTED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unsupported_extension: {ext}",
        )

    if file.size and file.size > settings.max_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"file_too_large (max {settings.max_image_bytes // (1024 * 1024)} MB)",
        )

    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="empty_file",
        )

    try:
        png_bytes = rasterize_to_png(data, ext=ext, dpi=dpi)
    except ValueError as exc:
        log.warning("Rasterize ValueError: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("Rasterize failed for %s", file.filename, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="rasterize_failed",
        ) from exc

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": "inline; filename=\"preview.png\""},
    )
