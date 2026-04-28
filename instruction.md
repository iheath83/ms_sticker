# Prompt pour IA de génération de code — E-commerce stickers personnalisés

> Usage : copie/colle ce prompt dans Claude Code, Cursor, v0, ou tout autre agent de codage. Tu peux aussi le découper et en livrer une section à la fois si l'outil a une fenêtre de contexte limitée.

---

## 1. Contexte & objectif

Tu dois construire **de zéro** un site e-commerce de stickers personnalisés, inspiré fonctionnellement de `aadesigns.co`. L'activité : impression de stickers vinyle / DTF sur mesure, basée en France.

La spécificité métier est le **workflow BAT (Bon À Tirer)** : le client upload un logo, reçoit une preview (proof) sous 24h, la valide (ou demande des corrections), **puis seulement paie**. Ce n'est pas un e-commerce classique "panier → paiement".

**Contraintes absolues :**
- Aucun CMS (pas de WordPress, Shopify, Wix, Prestashop, Sylius)
- Code 100% propriétaire, déployable sur un VPS que je possède
- Conformité française : TVA, RGPD, anticipation de la facturation électronique obligatoire B2B (sept. 2026 / 2027)
- UI en français, code et commentaires en anglais (sauf spécificités métier FR)

---

## 2. Stack technique imposée (ne pas dévier)

| Couche | Techno | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| Langage | TypeScript strict | 5.x |
| Base de données | PostgreSQL | 16 |
| ORM | Drizzle ORM | latest |
| Auth | Better-Auth | latest |
| Paiement | Stripe (Checkout + SEPA DD) | latest SDK |
| Facturation | Pennylane API | v2 |
| Stockage fichiers | Scaleway Object Storage (S3-compatible) | — |
| Emails | Brevo (API + SMTP fallback) | — |
| UI | Tailwind CSS v4 + shadcn/ui | latest |
| Validation | Zod | latest |
| Forms | React Hook Form | latest |
| Logs | Pino | latest |
| Tests | Vitest | latest |

**Interdits :**
- Prisma, Auth.js/NextAuth, Clerk, Auth0
- Vercel KV, Upstash, Supabase (DB), Firebase
- Material UI, Ant Design, Chakra
- Redux, Zustand (sauf justification explicite)
- Turbo, pnpm workspaces (monorepo inutile ici)

---

## 3. Structure de projet

Single Next.js app. Arborescence attendue :

```
/src
  /app
    /(shop)              # Public: landing, catalogue, configurateur
      /custom-stickers
      /products/[slug]
    /(account)           # Espace client authentifié
      /orders
      /orders/[id]
      /invoices
      /profile
    /(admin)             # Back-office (role=admin)
      /orders
      /customers
      /products
    /api
      /webhooks/stripe
      /webhooks/pennylane
      /uploads/presign
  /components
    /ui                  # shadcn/ui
    /shop                # Configurateur, price preview, upload
    /account
    /admin
  /db
    schema.ts            # Tout le schéma Drizzle
    index.ts             # Client Drizzle
    /migrations
  /lib
    auth.ts              # Better-Auth config
    stripe.ts
    pennylane.ts         # Client Pennylane typé
    storage.ts           # Client S3 Scaleway + presigned URLs
    mail.ts              # Brevo wrapper
    pricing.ts           # PURE FUNCTION - calcul prix (cf. §5)
    vat.ts               # Calcul TVA + validation VIES
  /server
    /actions             # Server Actions groupées par domaine
    /queries             # Data Access Layer (read-only)
  /env.ts                # Validation Zod des env vars au boot
```

**Règle stricte :** aucun fichier > 500 lignes. Découper.

---

## 4. Modèle de données (schéma Drizzle)

Tables à créer dans `/src/db/schema.ts`. Toutes les tables ont `id: uuid` (default `gen_random_uuid()`), `createdAt`, `updatedAt`.

### `users`
- `id`, `email` (unique), `name`, `phone`, `role` enum `customer|admin`, `deletedAt`

### `customer_profiles`
- `userId` (FK), `isProfessional` bool, `companyName`, `vatNumber`, `siret`
- `billingAddressId` (FK addresses), `defaultShippingAddressId` (FK addresses)

### `addresses`
- `userId` (FK), `line1`, `line2`, `postalCode`, `city`, `countryCode` (ISO-3166-2), `phone`

### `products`
- `id`, `slug` (unique), `name`, `description` (markdown), `basePriceCents`, `material`, `minWidthMm`, `maxWidthMm`, `minHeightMm`, `maxHeightMm`, `shapes` (text[]), `options` JSONB, `active`, `deletedAt`

### `orders`
- `id`, `userId` (FK), `status` enum, `subtotalCents`, `taxAmountCents`, `shippingCents`, `totalCents`, `currency` ('EUR')
- `vatRate` numeric, `vatReverseCharge` bool (B2B UE)
- `stripeCheckoutSessionId`, `stripePaymentIntentId`
- `pennylaneCustomerId`, `pennylaneInvoiceId`, `pennylaneInvoiceUrl`
- `shippingAddressId`, `billingAddressId`
- `trackingNumber`, `trackingCarrier`
- `notes` text, `internalNotes` text (admin-only)

**Status enum :** `draft | proof_pending | proof_sent | proof_revision_requested | approved | paid | in_production | shipped | delivered | cancelled`

Transitions autorisées à coder dans une state machine (fichier `/src/lib/order-state.ts`).

### `order_items`
- `orderId` (FK), `productId` (FK), `quantity`, `widthMm`, `heightMm`, `shape`, `options` JSONB
- `unitPriceCents`, `lineTotalCents`, `customizationNote`

### `order_files`
- `orderId` (FK), `type` enum `customer_upload|proof|final_artwork`, `version` int
- `storageKey` (clé Scaleway), `mimeType`, `sizeBytes`, `originalFilename`
- `uploadedById` (FK users)

### `order_events` — TABLE APPEND-ONLY (aucun UPDATE, aucun DELETE)
- `orderId` (FK), `type` (ex: `order.created`, `proof.uploaded`, `proof.approved`, `payment.received`, `shipped`)
- `actorId` (nullable si système), `payload` JSONB
- Sert d'audit trail légal

### `shipping_rates`
- `countryCode`, `method`, `priceCents`, `etaDaysMin`, `etaDaysMax`, `freeAbovCents` (seuil gratuité)

**Index obligatoires :** toutes les FK, `orders.status`, `orders.userId`, `users.email`, `order_events.orderId+createdAt`.

---

## 5. Moteur de prix (`/src/lib/pricing.ts`)

Module **pur**, isomorphe (utilisable serveur ET client pour la preview temps réel).

```typescript
export type PricingInput = {
  product: { basePriceCents: number; material: string };
  widthMm: number;
  heightMm: number;
  quantity: number;
  shape: 'die-cut' | 'kiss-cut' | 'square' | 'circle' | 'rect';
  options: { holographic?: boolean; glitter?: boolean; uvLaminated?: boolean };
  vatRate: number; // 0.20 par défaut
};

export type PricingOutput = {
  unitPriceCents: number;
  quantityDiscountPct: number;
  subtotalCents: number;
  optionsUpchargeCents: number;
  vatAmountCents: number;
  totalCents: number;
  breakdown: Array<{ label: string; amountCents: number }>;
};

export function computePrice(input: PricingInput): PricingOutput;
```

**Règles de prix :**
- Prix unitaire = basePrice × (area en cm²) × multiplicateur matériau
- Dégressif quantité : 50+ = -10%, 100+ = -15%, 250+ = -25%, 500+ = -35%, 1000+ = -45%
- Holographic : +30%, Glitter : +25%, UV laminated : +10%
- Shape `die-cut` : +15% par rapport à `rect`
- Arrondir au centime supérieur, jamais de flottants en stockage (tout en cents)

**Tests obligatoires** : fichier `pricing.test.ts` avec au minimum 15 cas couvrant les paliers, les options cumulées, les edge cases (quantité 1, taille min/max).

---

## 6. Parcours utilisateur

### Côté client

1. `/custom-stickers` : landing avec configurateur (sliders taille, input quantité, dropdown forme, checkboxes options). Preview prix mise à jour en temps réel via `computePrice` côté client.
2. Upload logo en drag-drop (max 50 MB, PNG/JPG/SVG/PDF/AI). Upload direct vers Scaleway via URL pré-signée (Server Action génère l'URL).
3. Clic "Commander" → crée un `order` en status `proof_pending`. Email client "On prépare votre BAT sous 24h". Email admin "Nouvelle commande à traiter".
4. Client peut se créer un compte après (ou avant) via Better-Auth (email + password, magic link en v2).
5. Admin upload le BAT → status `proof_sent` → email client avec lien vers `/account/orders/[id]`.
6. Page commande affiche : timeline, fichier client, dernier BAT, 2 CTAs :
   - **"Approuver et payer"** → Server Action crée Stripe Checkout Session → redirect
   - **"Demander une modification"** → textarea obligatoire → status `proof_revision_requested`
7. Retour Stripe → webhook `checkout.session.completed` → status `paid` → appel Pennylane pour créer la facture → email client avec PDF facture attaché.
8. Suivi : page order affiche timeline complète + tracking une fois expédié.

### Côté admin

1. `/admin` protégé middleware (role check).
2. Dashboard : compteurs par statut, liste des commandes en `proof_pending` (action requise).
3. Détail commande : upload BAT (nouvelle version), éditer notes internes, changer statut manuel (`paid` → `in_production` → `shipped` avec saisie tracking).
4. CRUD produits simple.
5. Liste clients avec historique.

---

## 7. Intégrations — détails

### 7.1 Stripe
- **Stripe Checkout** (hosted page, pas Elements pour le MVP)
- Modes : `card` + `sepa_debit`
- `metadata: { orderId }` sur chaque session
- Webhook `/api/webhooks/stripe` **avec vérification de signature** (`stripe.webhooks.constructEvent`)
- Events gérés : `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`
- Idempotence : stocker `stripeEventId` traités dans une table `webhook_events`

### 7.2 Pennylane API
- Client TypeScript dans `/src/lib/pennylane.ts`
- Au `checkout.session.completed` :
  1. GET/CREATE customer (via email + SIRET si B2B)
  2. CREATE invoice avec line items dérivés de `order_items`
  3. FINALIZE + SEND (ou juste FINALIZE, selon préférence)
  4. Stocker `pennylaneInvoiceId` + URL PDF dans `orders`
- Gérer les erreurs : si Pennylane down, commande reste en `paid`, retry via cron léger
- **Ne pas générer de facture en interne** — Pennylane est la source de vérité légale

### 7.3 Scaleway Object Storage
- Bucket privé, region `fr-par` ou `nl-ams`
- Client S3 via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Upload client : Server Action retourne une POST presigned URL (15 min TTL)
- Download client : Server Action retourne une GET presigned URL (1h TTL)
- Structure des clés : `orders/{orderId}/{type}/{yyyymmdd}-{uuid}-{filename}`
- Scan antivirus sur uploads : hors scope MVP, noter en TODO

### 7.4 Brevo
- Emails transactionnels via API (pas SMTP)
- Templates MJML dans `/src/lib/emails/templates/`, compilés au build
- Templates requis : `order-received`, `proof-ready`, `proof-revision-acknowledged`, `payment-received`, `order-shipped`, `password-reset`
- Footer légal standard FR sur tous les emails

---

## 8. Authentification (Better-Auth)

- Session-based (cookie HTTPOnly + SameSite=Lax), pas de JWT côté client
- Email + password, bcrypt rounds=12
- Reset password via lien signé (expire 1h)
- Middleware Next.js protège `/(account)` et `/(admin)`
- Role check côté serveur dans chaque Server Action admin (ne jamais faire confiance au middleware seul)
- Rate limiting sur `/login` et `/signup` (5 tentatives / 15 min / IP) — via table `rate_limits` en DB ou `@upstash/ratelimit` self-hosted avec Redis… **OU** simple implémentation PostgreSQL (préférer ça pour rester "maison")

---

## 9. Conformité & obligations légales FR

- **Pages légales** à scaffolder avec contenu placeholder : `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/politique-cookies`
- **Cookie banner** custom (pas de solution tierce type Axeptio). Seulement cookies essentiels + analytics opt-in
- **RGPD** : Server Action `exportUserData` (retourne JSON complet) + Server Action `deleteUserAccount` (soft-delete + anonymisation orders > 10 ans de conservation légale)
- **TVA** :
  - FR : 20% par défaut
  - B2B UE hors FR avec numéro TVA valide (via VIES API) : 0% + mention "Autoliquidation - Art. 283-2 du CGI"
  - Hors UE : 0% (export)
  - Module `/src/lib/vat.ts` avec cache VIES 24h en DB
- **Facturation électronique 2026/2027** : puisque Pennylane gère, la conformité Factur-X est assurée. Documenter ce choix dans un `/docs/compliance.md`
- **`order_events` append-only** : créer un trigger PostgreSQL qui bloque UPDATE et DELETE

---

## 10. Variables d'environnement

Fichier `/src/env.ts` valide au boot avec Zod. Variables attendues :

```
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLIC_KEY=

PENNYLANE_API_KEY=
PENNYLANE_API_BASE=

SCW_ACCESS_KEY=
SCW_SECRET_KEY=
SCW_BUCKET=
SCW_REGION=
SCW_ENDPOINT=

BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=

VIES_CACHE_TTL_HOURS=24
APP_URL=
APP_ENV=development|production
```

Un `.env.example` commité à jour en permanence.

---

## 11. Conventions de code

- TS config : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- Aucun `any`, aucun `@ts-ignore` (utiliser `@ts-expect-error` avec commentaire si vraiment bloqué)
- **Server Actions pour toute mutation, Server Components pour toute lecture**
- Route Handlers uniquement pour : webhooks, génération de presigned URLs retournées en JSON
- Validation Zod systématique aux frontières (form input, webhook payload, API externe response)
- **Result pattern** plutôt que throw pour les erreurs métier : `type Result<T, E> = { ok: true; data: T } | { ok: false; error: E }`
- Logs structurés via Pino avec `requestId` propagé
- Drizzle : préférer les requêtes explicites, SQL raw pour les cas complexes (search, analytics)
- Tests Vitest sur `/src/lib/pricing.ts`, `/src/lib/vat.ts`, `/src/lib/pennylane.ts` (avec mocks), state machine orders
- Format : Prettier + ESLint config Next.js + `eslint-plugin-drizzle`

---

## 12. Plan de livraison (ordre strict, étape par étape)

À chaque étape, livre : **(a)** le code, **(b)** les migrations Drizzle générées, **(c)** un court README "comment tester manuellement", **(d)** les tests Vitest si applicable.

**Étape 1** — Bootstrap : Next.js 15 + TS strict + Tailwind v4 + shadcn/ui + Drizzle + Postgres local + `/src/env.ts`
**Étape 2** — Schéma DB complet (toutes les tables) + migration initiale + seed de 5 produits
**Étape 3** — Better-Auth : signup / login / logout / reset password + pages associées + middleware
**Étape 4** — Page `/custom-stickers` : configurateur + moteur `pricing.ts` + preview temps réel + tests
**Étape 5** — Upload Scaleway : presigned URLs + composant drag-drop + stockage `order_files`
**Étape 6** — Création de commande (draft → proof_pending) + email admin/client (Brevo)
**Étape 7** — Back-office admin minimal : liste orders, détail, upload BAT
**Étape 8** — Workflow BAT côté client : approve / request revision
**Étape 9** — Stripe Checkout + webhook + transitions de statut
**Étape 10** — Intégration Pennylane (création facture au paiement)
**Étape 11** — Espace client complet : orders, invoices download, profile
**Étape 12** — TVA (module `vat.ts` + VIES), pages légales, cookie banner, RGPD actions
**Étape 13** — Emails transactionnels restants + templates MJML
**Étape 14** — Production readiness : Dockerfile, `docker-compose.yml` pour dev, script de migration Scaleway, doc de déploiement sur VPS

---

## 13. Ce qu'il NE FAUT PAS faire

- ❌ `use client` par défaut — composants serveur sauf nécessité prouvée (interactivité, hooks)
- ❌ API REST publique exposée sans raison — Server Actions suffisent pour les besoins internes
- ❌ Stockage fichier local (`/public/uploads`) — tout va sur Scaleway
- ❌ Génération de facture PDF en interne — Pennylane uniquement
- ❌ Envoi d'email depuis le navigateur ou via `mailto:` — toujours Brevo serveur
- ❌ Clés API en dur dans le code — toutes dans env vars validées
- ❌ Migrer des données entre status sans passer par la state machine
- ❌ UPDATE ou DELETE sur `order_events`
- ❌ Commit de secrets ou de `.env`
- ❌ Utiliser une version beta/RC d'une lib sans justification

---

## 14. Démarrage

Commence par l'**Étape 1** et attends validation avant de passer à l'Étape 2. À chaque étape, affiche :
1. Le résumé de ce qui a été fait
2. Les fichiers créés/modifiés (arbre)
3. Comment tester manuellement (3-5 commandes + checks)
4. Les questions ouvertes / décisions à prendre

Si une exigence te semble ambiguë ou contradictoire, **demande avant de coder**. Ne fais pas de choix silencieux sur le métier.
