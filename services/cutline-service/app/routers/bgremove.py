"""Endpoint de suppression de fond."""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.services.bgremove import remove_background
from app.settings import settings

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/background/remove")
async def background_remove_endpoint(
    file: Annotated[UploadFile, File(description="Image PNG/JPG/WEBP")],
) -> Response:
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

    try:
        png_bytes = remove_background(image_bytes)
    except Exception as exc:  # noqa: BLE001
        log.exception("rembg failed", exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="background_removal_failed",
        ) from exc

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": "inline; filename=\"no-bg.png\""},
    )
