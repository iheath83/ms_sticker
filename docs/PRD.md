# PRD — MS Adhésif (msadhesif.fr)

**E-commerce de stickers personnalisés sur mesure**

Document de référence produit. Version 1.0 — état réel du projet à date.

---

## 1. Vision & objectif

Construire un site e-commerce **propriétaire** (sans CMS tiers) pour la vente de stickers personnalisés vinyle / DTF imprimés à la demande en France. Différenciation par un workflow **BAT (Bon À Tirer)** : le client envoie son visuel, reçoit une preview validée par l'atelier sous 24 h, valide, **puis paie** — l'inverse d'un e-commerce classique.

**Objectifs business :**

- Permettre la commande de stickers 100 % personnalisés sans intervention manuelle pour les commandes simples
- Garantir la conformité légale FR (TVA, RGPD, facturation électronique 2026/2027)
- Être 100 % auto-hébergé sur VPS dédié (Dokploy) — souveraineté totale des données et du code

---

## 2. Utilisateurs cibles

| Persona | Description | Besoin clé |
|---|---|---|
| **Client B2C particulier** | Veut quelques stickers pour décoration / personnalisation | Configurateur simple, prix transparent, visuel rendu fidèle |
| **Client B2B pro** | TPE/PME qui commande en quantité (boutiques, food trucks, événementiel) | Devis, autoliquidation TVA UE, facture conforme, livraisons régulières |
| **Admin atelier** | Opère l'atelier, gère production et expédition | Back-office complet : commandes, BAT, produits, expéditions, factures |

---

## 3. Périmètre fonctionnel

### 3.1 Côté client (front-shop)

| Module | Pages | État |
|---|---|---|
| **Vitrine** | Landing, catalogue, fiche produit, FAQ, contact, devis pro, CGV, mentions légales, RGPD | Implémenté |
| **Configurateur produit** | Choix taille / forme / matériau / quantité / lamination / options. Prix temps réel. Upload visuel | Implémenté |
| **Éditeur visuel sticker** | Modal Konva : import PNG/JPG/SVG/PDF, redimensionnement proportionnel, rotation, génération auto de la ligne de coupe (rectangle ou découpe à la forme), suppression de fond IA | Implémenté |
| **Panier + checkout** | Stripe Checkout (carte + SEPA), création compte optionnel | Implémenté |
| **Espace client** | Mes commandes, BATs, factures, profil, adresses | Implémenté |
| **Avis clients** | Demande email post-livraison → page note + commentaire | Implémenté |

### 3.2 Côté admin (back-office)

| Module | Description | État |
|---|---|---|
| **Dashboard** | KPIs : commandes du jour, à traiter, CA | Implémenté |
| **Commandes** | Liste filtrable, détail, upload BAT, transitions état, tracking | Implémenté |
| **Produits** | CRUD + variants taille / matériau, paliers de prix dégressifs | Implémenté |
| **Catégories** | Hiérarchie, slug, image | Implémenté |
| **Clients** | Liste, détail, historique commandes | Implémenté |
| **Codes promo** | % ou montant fixe, conditions (min panier, exp, code unique vs limité) | Implémenté |
| **Pages CMS** | Édition de blocs (sections réutilisables) pour landing & contenus | Implémenté |
| **Navigation** | Menu principal éditable | Implémenté |
| **Emails transactionnels** | Templates éditables (Brevo + fallback Unlayer) | Implémenté |
| **Avis** | Modération, paramétrage des envois automatiques | Implémenté |
| **Expéditions** | Zones, calendrier, méthodes, règles, simulateur, points relais (SendCloud) | Implémenté |
| **Réglages** | TVA, mentions, infos société, config Pennylane / Stripe | Implémenté |

### 3.3 Workflow BAT (cœur métier)

```
draft  →  proof_pending  →  proof_sent  ⇄  proof_revision_requested
                                  ↓
                              approved  →  paid  →  in_production  →  shipped  →  delivered
                                                                                       ↓
                                                                                  cancelled
```

Transitions strictement encadrées par la state machine (`src/lib/order-state.ts`, testée Vitest). Tous les changements d'état génèrent un événement append-only dans `order_events` (audit trail légal).

---

## 4. Architecture technique

### 4.1 Stack

| Couche | Techno |
|---|---|
| Framework | **Next.js 16** (App Router, Server Actions, RSC) |
| Langage | TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| BDD | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | Better-Auth (sessions cookie HTTPOnly) |
| Paiement | Stripe (Checkout + SEPA Direct Debit) |
| Facturation | **Pennylane API v2** (source de vérité légale, pas de PDF interne) |
| Stockage objet | **Scaleway S3** (prod) / MinIO (dev) — bucket privé, presigned URLs |
| Email | Brevo (API + templates MJML compilés au build) |
| Expédition | **SendCloud** (étiquettes, tracking, points relais) |
| UI | Tailwind CSS v4 + shadcn/ui + Konva (éditeur visuel) |
| Validation | Zod aux frontières |
| Tests | Vitest |
| Logs | Pino structuré, requestId propagé |

### 4.2 Microservice Python

| Service | Tech | Rôle |
|---|---|---|
| **`cutline-service`** | FastAPI + OpenCV + rembg (IS-Net) | Génération de la ligne de coupe à partir du canal alpha + suppression de fond IA. Container séparé sur réseau Docker interne, auth Bearer partagée |

### 4.3 Déploiement

- **Dokploy** sur VPS dédié, **Traefik** reverse proxy + Let's Encrypt
- `docker-compose.prod.yml` : `app`, `cutline`, `postgres`, `migrate` (one-shot)
- Image Next.js : `ghcr.io/iheath83/ms_sticker:latest` (CI sur tag)
- Healthchecks Docker, restart `unless-stopped`

### 4.4 Structure du code (extrait)

```
src/
  app/
    (shop)/         landing, catalogue, fiches produit, légal
    (admin)/        back-office complet
    account/        espace client
    api/            webhooks (Stripe, Pennylane, SendCloud), uploads, sticker-editor
  components/
    sticker-editor/ Konva editor + canvas client
    product-configurator/
    admin/, shop/, account/
  db/
    schema.ts       schéma Drizzle complet
    migrations/
  lib/
    auth.ts, stripe.ts, pennylane.ts, storage.ts
    pricing.ts      moteur de prix isomorphe testé
    vat.ts          TVA + cache VIES
    order-state.ts  state machine + tests
    sticker-editor/ services cutline (client + serveur Python proxy)
services/
  cutline-service/  FastAPI + OpenCV + rembg
```

**Règle :** aucun fichier > 500 lignes.

---

## 5. Modèle de données (principales tables)

| Table | Rôle |
|---|---|
| `users` + `customer_profiles` | Comptes (B2C/B2B), SIRET, TVA intra |
| `addresses` | Multi-adresses livraison/facturation |
| `products`, `categories` | Catalogue, slugs SEO, paliers de prix |
| `orders`, `order_items`, `order_files` | Commandes + visuels uploadés/BATs |
| `order_events` | **Append-only**, trigger PostgreSQL bloquant UPDATE/DELETE |
| `discounts`, `discount_redemptions` | Codes promo + utilisations |
| `shipping_zones`, `shipping_methods`, `shipping_rules`, `shipping_calendar` | Logistique configurable |
| `reviews`, `review_requests` | Avis clients post-livraison |
| `pages`, `page_sections`, `nav_items` | CMS minimal |
| `email_templates` | Personnalisation des emails |
| `webhook_events` | Idempotence Stripe / Pennylane |
| `vies_cache` | TVA UE 24 h |
| `rate_limits` | Anti-bruteforce login + rate limiting API |
| `settings` | Config globale modifiable depuis l'admin |

Tous les UUID en `gen_random_uuid()`, `createdAt`/`updatedAt` systématiques, FK indexées.

---

## 6. Moteur de prix

`src/lib/pricing.ts` (et `sticker-pricing.ts`) : pure function isomorphe utilisable serveur **et** client (preview live).

- Tarif unitaire = base × surface (cm²) × multiplicateur matériau
- Dégressifs quantité : 50/100/250/500/1000 → -10 / -15 / -25 / -35 / -45 %
- Options : Holographique +30 %, Glitter +25 %, UV laminé +10 %, Découpe forme +15 %
- Tout stocké en **centimes** (jamais de flottant)
- Tests Vitest : 15+ cas (paliers, options cumulées, edge cases)

---

## 7. Intégrations externes

| Service | Usage | Détails |
|---|---|---|
| **Stripe** | Checkout + webhooks signés | Modes carte + SEPA. `metadata.orderId` sur chaque session. Idempotence via `webhook_events` |
| **Pennylane** | Création de facture **après paiement** | GET/CREATE customer (par email + SIRET), CREATE invoice, FINALIZE+SEND. PDF stocké côté Pennylane, URL dans `orders.pennylaneInvoiceUrl` |
| **SendCloud** | Étiquettes, tracking, points relais | Webhook signé pour mise à jour statut expédition |
| **Brevo** | Emails transactionnels | API (pas SMTP), templates : `order-received`, `proof-ready`, `proof-revision-acknowledged`, `payment-received`, `order-shipped`, `password-reset`, `review-request` |
| **VIES** | Validation TVA intracommunautaire | Cache 24 h en DB, fallback gracieux si service down |
| **Scaleway S3** | Stockage des uploads, BATs, fichiers de prod | Bucket privé, presigned URLs (POST 15 min, GET 1 h). Clés : `orders/{orderId}/{type}/{yyyymmdd}-{uuid}-{filename}` |
| **rembg + OpenCV** (interne Python) | Suppression de fond IA + génération cutline | Modèle `isnet-general-use` pré-téléchargé au build |

---

## 8. Conformité légale FR

- **Pages légales** : mentions, CGV, politique confidentialité, politique cookies (toutes implémentées)
- **Cookie banner** custom (pas de solution tierce), opt-in analytics
- **RGPD** :
  - Server Action `exportUserData` → export JSON complet
  - Server Action `deleteUserAccount` → soft-delete + anonymisation des commandes (rétention légale 10 ans)
- **TVA** :
  - FR : 20 %
  - B2B UE hors FR + TVA valide (VIES) : 0 % avec mention « Autoliquidation – Art. 283-2 du CGI »
  - Hors UE : 0 % (export)
- **Facturation électronique 2026/2027** : déléguée à Pennylane (Factur-X conforme)
- **Audit trail** : `order_events` append-only, trigger PostgreSQL bloquant

---

## 9. Exigences non-fonctionnelles

### Sécurité

- Cookies session HTTPOnly + SameSite=Lax (pas de JWT côté client)
- Bcrypt rounds=12, reset password lien signé 1 h
- Webhooks signés (Stripe `constructEvent`, SendCloud, Pennylane)
- Rate limiting login (5 tentatives / 15 min / IP) + API publique
- CSP stricte (`connect-src` limité, `script-src` Stripe whitelist)
- Pas d'API REST publique sans raison — Server Actions par défaut
- Tous secrets en env vars validées Zod au boot (`src/env.ts`)

### Performance

- Server Components par défaut, `use client` sur justification
- Streaming + Suspense sur les pages catalogue
- Images optimisées (`next/image`)
- Cache HTTP des presigned URLs (court TTL)

### Observabilité

- Logs structurés Pino + requestId
- Healthchecks Docker `/api/health`
- Webhook `/api/webhooks/stripe` idempotent

### Qualité

- ESLint + Prettier + `eslint-plugin-drizzle`
- TypeScript strict, zéro `any`, zéro `@ts-ignore`
- Tests Vitest sur `pricing.ts`, `vat.ts`, `pennylane.ts`, `order-state.ts`
- Result pattern `{ ok, data | error }` plutôt que throw pour erreurs métier

---

## 10. KPI produit

| KPI | Cible MVP |
|---|---|
| Délai BAT (commande → preview envoyée) | < 24 h ouvrées |
| Taux de validation BAT au 1er coup | > 70 % |
| Taux d'abandon configurateur | < 30 % |
| Conversion visite → commande | > 2 % |
| NPS / note moyenne avis | > 4,5 / 5 |
| Délai expédition (paiement → expédié) | < 48 h ouvrées |

---

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Pennylane indisponible au paiement | Commande reste `paid`, retry via cron léger, alerte admin |
| Charge CPU rembg/OpenCV (suppression fond) | Container séparé, rate limit serré (12 req / 5 min), fallback sur conservation du fond |
| Container `cutline` change d'IP au redeploy | Undici Agent keep-alive court (1 s) + retry sur ECONNREFUSED |
| Validation TVA VIES down | Cache 24 h, fallback "TVA FR 20 %" + alerte |
| Upload de fichier malveillant | Type MIME whitelist, taille max 50 MB, scan AV à prévoir post-MVP |
| Conformité Factur-X | Déléguée à Pennylane (mise à jour automatique) |

---

## 12. Roadmap

### Livré (MVP+)

- ✅ Catalogue + configurateur + moteur de prix
- ✅ Workflow BAT complet
- ✅ Stripe + Pennylane + SendCloud + Brevo
- ✅ Espace client + back-office complet
- ✅ Codes promo, avis, CMS minimal, multi-zones expédition
- ✅ Éditeur visuel Konva + microservice Python (cutline + bg removal)
- ✅ Conformité RGPD + TVA + Factur-X via Pennylane

### Court terme (Q2 2026)

- 🔜 Tunnel devis pro complet (workflow distinct du BAT)
- 🔜 Magic link login (sans password)
- 🔜 Scan antivirus uploads (ClamAV containerisé)
- 🔜 Multi-langue (EN) pour B2B export
- 🔜 Optimisations SEO catalogue (schemas.org product)

### Moyen terme (Q3-Q4 2026)

- 🔜 Programme de fidélité / abonnement réimpression
- 🔜 API publique pour partenaires (revendeurs)
- 🔜 Conformité PEPPOL pour facturation électronique B2B obligatoire

---

## 13. Hors périmètre (non-goals)

- Pas de marketplace multi-vendeurs
- Pas de Print On Demand sur produits autres que stickers (pas de t-shirts, mugs, etc.)
- Pas d'app mobile native (mobile web responsive uniquement)
- Pas de génération de facture PDF interne (Pennylane est la source de vérité)
- Pas de tracking analytics tiers sans consentement explicite
- Pas de CMS tiers (WordPress, Shopify, etc.)
