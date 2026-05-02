# syntax=docker/dockerfile:1.6
# ─── MS Adhésif – Cutline Service (Python FastAPI + OpenCV + rembg) ───────────

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dépendances système pour OpenCV (libgl1, libglib2) et rembg/onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Étape 1 : install des deps Python (cache layer) ──────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Étape 2 : pré-télécharger le modèle rembg dans /root/.u2net ──────────────
# Évite un cold start de plusieurs secondes au premier appel
RUN python -c "from rembg import new_session; new_session('isnet-general-use')"

# ─── Étape 3 : code applicatif ────────────────────────────────────────────────
COPY app/ ./app/

# ─── Runtime ──────────────────────────────────────────────────────────────────
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
