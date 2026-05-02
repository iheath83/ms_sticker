# MS Adhésif – Cutline Service

Microservice Python pour le traitement d'images du configurateur sticker.

## Endpoints

### `POST /api/cutline`

Génère une ligne de coupe (cutline) à partir du canal alpha d'une image, via OpenCV
(`findContours` + `morphologyEx` + `approxPolyDP`).

**Body** (multipart/form-data) :
- `file` : image PNG/JPG/WEBP (canal alpha requis pour résultat correct)
- `offset_mm` : marge de coupe en mm (default 2)
- `dpi` : DPI cible pour conversion mm↔px (default 300)
- `close_radius_px` : rayon de fermeture morphologique en px d'analyse (default 8)

**Response** :
```json
{
  "ok": true,
  "result": {
    "svg_path": "M10,20 L100,30 ...Z",
    "width_px": 856,
    "height_px": 914,
    "point_count": 42,
    "has_transparency": true
  }
}
```

### `POST /api/background/remove`

Supprime le fond d'une image avec [rembg](https://github.com/danielgatis/rembg)
(modèle `isnet-general-use`).

**Body** (multipart/form-data) :
- `file` : image PNG/JPG/WEBP

**Response** : PNG binaire (`Content-Type: image/png`) avec fond transparent.

### `GET /healthz`

Health check (200 OK si modèle rembg chargé).

## Authentification

Toutes les routes (sauf `/healthz`) requièrent le header
`Authorization: Bearer <CUTLINE_SERVICE_API_KEY>`.
La clé est partagée entre le service Next.js (proxy) et ce service.

## Développement local

```bash
cd services/cutline-service
docker build -t ms-cutline .
docker run -p 8001:8000 -e API_KEY=devkey ms-cutline

# Test
curl -X POST http://localhost:8001/api/cutline \
  -H "Authorization: Bearer devkey" \
  -F "file=@logo.png" -F "offset_mm=2"
```

## Déploiement Dokploy

Voir `docker-compose.prod.yml` à la racine du projet : le service `cutline` est
ajouté à côté de `app`, sur le réseau `internal`. Aucun port exposé publiquement,
seul Next.js l'appelle.

## Dépendances

- **FastAPI** : framework HTTP async
- **opencv-python-headless** : traitement d'image (pas de GUI)
- **rembg** : suppression de fond IA (U²-Net / IS-Net)
- **Pillow** : I/O image
- **uvicorn** : serveur ASGI

## Modèle ML

`isnet-general-use` (~180 MB) téléchargé au build dans `/root/.u2net/`.
Pour changer de modèle : modifier `REMBG_MODEL` dans `app/settings.py`.
