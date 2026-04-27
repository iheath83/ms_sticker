# Guide de déploiement VPS — MS Adhésif

## Prérequis

| Composant | Version minimale |
|-----------|-----------------|
| VPS | 2 vCPU · 4 Go RAM · Ubuntu 22.04 LTS |
| Docker Engine | 25+ |
| Docker Compose | v2 (plugin) |
| Domaine DNS | `msadhesif.fr` → IP VPS |

---

## 1. Provisionnement initial du VPS

```bash
# Sur le VPS en tant que root
apt update && apt upgrade -y
apt install -y git curl ufw

# Pare-feu
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER  # ou un utilisateur dédié
```

---

## 2. Traefik (reverse proxy + TLS automatique)

Traefik gère les certificats Let's Encrypt et le routage vers le conteneur Next.js.

```bash
mkdir -p /srv/traefik
cat > /srv/traefik/docker-compose.yml << 'EOF'
services:
  traefik:
    image: traefik:v3
    restart: unless-stopped
    command:
      - "--api.dashboard=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=hello@msadhesif.fr"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./acme.json:/acme.json
    networks:
      - web
networks:
  web:
    external: true
EOF

touch /srv/traefik/acme.json && chmod 600 /srv/traefik/acme.json
docker network create web
cd /srv/traefik && docker compose up -d
```

---

## 3. Déploiement de l'application

### 3.1 Récupérer le code et les variables d'environnement

```bash
mkdir -p /srv/ms-adhesif
cd /srv/ms-adhesif

# Copier docker-compose.prod.yml depuis le repo (ou scp depuis CI/CD)
scp docker-compose.prod.yml user@vps:/srv/ms-adhesif/

# Créer .env à partir du template — NE PAS COMMETTRE ce fichier
cp .env.example .env
nano .env  # Remplir toutes les valeurs CHANGE_ME
```

### 3.2 Premier démarrage

```bash
cd /srv/ms-adhesif

# Lancer uniquement postgres en premier pour vérifier la connectivité
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml logs postgres  # attendre "ready to accept connections"

# Migrations initiales
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml run --rm migrate

# Lancer l'application
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d app
```

### 3.3 Déploiements suivants (via script)

```bash
cd /srv/ms-adhesif
./scripts/deploy.sh <IMAGE_TAG>
# ex: ./scripts/deploy.sh v1.2.3
```

---

## 4. Pipeline CI/CD (GitHub Actions)

Exemple de workflow `.github/workflows/deploy.yml` :

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: |
            ghcr.io/iheath83/ms_sticker:latest
            ghcr.io/iheath83/ms_sticker:${{ github.sha }}

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /srv/ms-adhesif
            ./scripts/deploy.sh ${{ github.sha }}
```

**Secrets GitHub requis :**
- `VPS_HOST` — IP ou hostname du VPS
- `VPS_USER` — utilisateur SSH (ex: `deploy`)
- `VPS_SSH_KEY` — clé privée SSH (sans passphrase)

---

## 5. Sauvegardes PostgreSQL

Script à lancer via cron (`crontab -e`) :

```bash
# Sauvegarde quotidienne à 3h00
0 3 * * * docker exec ms-adhesif-postgres-1 \
  pg_dump -U msadhesif msadhesif | gzip \
  > /srv/backups/msadhesif-$(date +\%Y\%m\%d).sql.gz

# Nettoyage des backups > 30 jours
0 4 * * * find /srv/backups -name "msadhesif-*.sql.gz" -mtime +30 -delete
```

---

## 6. Stripe webhooks en production

Dans le dashboard Stripe :
- **Endpoint URL** : `https://msadhesif.fr/api/webhooks/stripe`
- **Événements** : `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`
- Copier le `Signing secret` → variable `STRIPE_WEBHOOK_SECRET` dans `.env`

---

## 7. Vérifications post-déploiement

```bash
# Application alive
curl -I https://msadhesif.fr

# Health check interne
curl https://msadhesif.fr/api/health

# Logs en temps réel
docker compose -f /srv/ms-adhesif/docker-compose.prod.yml logs -f app

# Status des conteneurs
docker compose -f /srv/ms-adhesif/docker-compose.prod.yml ps
```

---

## 8. Rollback

```bash
# Revenir à une image précédente
cd /srv/ms-adhesif
./scripts/deploy.sh <SHA_PRÉCÉDENT>
```
