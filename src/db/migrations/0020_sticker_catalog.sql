-- 0020 — Sticker catalog: shapes, sizes, materials, laminations, cut types, product config

-- ─── sticker_shapes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sticker_shapes" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"                 VARCHAR(50)  NOT NULL UNIQUE,
  "name"                 VARCHAR(255) NOT NULL,
  "description"          TEXT,
  "is_standard_shape"    BOOLEAN      NOT NULL DEFAULT TRUE,
  "requires_cut_path"    BOOLEAN      NOT NULL DEFAULT FALSE,
  "price_modifier_type"  VARCHAR(20)  NOT NULL DEFAULT 'none',
  "price_modifier_value" REAL         NOT NULL DEFAULT 1,
  "icon_svg"             TEXT,
  "is_active"            BOOLEAN      NOT NULL DEFAULT TRUE,
  "position"             INTEGER      NOT NULL DEFAULT 0,
  "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sticker_shapes_code_idx" ON "sticker_shapes"("code");

-- ─── sticker_sizes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sticker_sizes" (
  "id"           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "label"        VARCHAR(100) NOT NULL,
  "width_mm"     INTEGER     NOT NULL,
  "height_mm"    INTEGER     NOT NULL,
  "is_preset"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "is_active"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "min_quantity" INTEGER,
  "position"     INTEGER     NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── sticker_materials ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sticker_materials" (
  "id"                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"                      VARCHAR(50)  NOT NULL UNIQUE,
  "name"                      VARCHAR(255) NOT NULL,
  "description"               TEXT,
  "is_waterproof"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "is_outdoor_compatible"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "is_transparent"            BOOLEAN     NOT NULL DEFAULT FALSE,
  "is_premium"                BOOLEAN     NOT NULL DEFAULT FALSE,
  "price_modifier_type"       VARCHAR(20) NOT NULL DEFAULT 'multiplier',
  "price_modifier_value"      REAL        NOT NULL DEFAULT 1,
  "compatible_lamination_codes" TEXT[]    NOT NULL DEFAULT '{}',
  "preview_image_url"         TEXT,
  "is_active"                 BOOLEAN     NOT NULL DEFAULT TRUE,
  "position"                  INTEGER     NOT NULL DEFAULT 0,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sticker_materials_code_idx" ON "sticker_materials"("code");

-- ─── sticker_laminations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sticker_laminations" (
  "id"                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"                     VARCHAR(50)  NOT NULL UNIQUE,
  "name"                     VARCHAR(255) NOT NULL,
  "description"              TEXT,
  "price_modifier_type"      VARCHAR(20) NOT NULL DEFAULT 'multiplier',
  "price_modifier_value"     REAL        NOT NULL DEFAULT 1,
  "compatible_material_codes" TEXT[]     NOT NULL DEFAULT '{}',
  "is_default"               BOOLEAN     NOT NULL DEFAULT FALSE,
  "is_active"                BOOLEAN     NOT NULL DEFAULT TRUE,
  "position"                 INTEGER     NOT NULL DEFAULT 0,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sticker_laminations_code_idx" ON "sticker_laminations"("code");

-- ─── sticker_cut_types ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sticker_cut_types" (
  "id"                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"                 VARCHAR(50)  NOT NULL UNIQUE,
  "name"                 VARCHAR(255) NOT NULL,
  "description"          TEXT,
  "requires_cut_path"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "price_modifier_type"  VARCHAR(20) NOT NULL DEFAULT 'multiplier',
  "price_modifier_value" REAL        NOT NULL DEFAULT 1,
  "is_active"            BOOLEAN     NOT NULL DEFAULT TRUE,
  "position"             INTEGER     NOT NULL DEFAULT 0,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sticker_cut_types_code_idx" ON "sticker_cut_types"("code");

-- ─── product_sticker_configs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "product_sticker_configs" (
  "id"                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id"             UUID        NOT NULL UNIQUE REFERENCES "products"("id") ON DELETE CASCADE,
  "enabled_shape_ids"      JSONB       NOT NULL DEFAULT '[]',
  "enabled_size_ids"       JSONB       NOT NULL DEFAULT '[]',
  "enabled_material_ids"   JSONB       NOT NULL DEFAULT '[]',
  "enabled_lamination_ids" JSONB       NOT NULL DEFAULT '[]',
  "enabled_cut_type_ids"   JSONB       NOT NULL DEFAULT '[]',
  "allow_custom_width"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "allow_custom_height"    BOOLEAN     NOT NULL DEFAULT FALSE,
  "min_width_mm"           INTEGER     NOT NULL DEFAULT 20,
  "max_width_mm"           INTEGER     NOT NULL DEFAULT 1000,
  "min_height_mm"          INTEGER     NOT NULL DEFAULT 20,
  "max_height_mm"          INTEGER     NOT NULL DEFAULT 1000,
  "require_file_upload"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "allowed_file_extensions" TEXT[]     NOT NULL DEFAULT ARRAY['pdf','ai','eps','svg','png','jpg','jpeg'],
  "max_file_size_mb"       INTEGER     NOT NULL DEFAULT 100,
  "default_shape_id"       UUID,
  "default_material_id"    UUID,
  "default_lamination_id"  UUID,
  "default_cut_type_id"    UUID,
  "price_per_cm2_cents"    INTEGER     NOT NULL DEFAULT 150,
  "quantity_tiers"         JSONB       NOT NULL DEFAULT '[]',
  "setup_fee_cents"        INTEGER     NOT NULL DEFAULT 0,
  "min_order_cents"        INTEGER     NOT NULL DEFAULT 0,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "product_sticker_configs_product_id_idx" ON "product_sticker_configs"("product_id");

-- ─── Alter products — add product_family ────────────────────────────────────
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_family" VARCHAR(50) NOT NULL DEFAULT 'sticker';

-- ─── Alter order_items — add sticker_config ──────────────────────────────────
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "sticker_config" JSONB;

-- ─── Seed default shapes ─────────────────────────────────────────────────────
INSERT INTO "sticker_shapes" ("code","name","description","is_standard_shape","requires_cut_path","price_modifier_type","price_modifier_value","position")
VALUES
  ('die_cut',       'Découpe à la forme', 'Suit exactement les contours de votre visuel', FALSE, TRUE,  'multiplier', 1.15, 1),
  ('round',         'Rond',               'Cercle parfait',                               TRUE,  FALSE, 'none',       1,    2),
  ('square',        'Carré',              'Coins droits',                                 TRUE,  FALSE, 'none',       1,    3),
  ('rectangle',     'Rectangle',          'Format rectangle libre',                       TRUE,  FALSE, 'none',       1,    4),
  ('rounded_square','Carré arrondi',      'Coins légèrement arrondis',                    TRUE,  FALSE, 'none',       1,    5),
  ('oval',          'Ovale',              'Ellipse',                                       TRUE,  FALSE, 'none',       1,    6),
  ('custom_shape',  'Forme personnalisée','Toute autre forme',                            FALSE, TRUE,  'multiplier', 1.2,  7)
ON CONFLICT ("code") DO NOTHING;

-- ─── Seed default sizes ──────────────────────────────────────────────────────
INSERT INTO "sticker_sizes" ("label","width_mm","height_mm","is_preset","position")
VALUES
  ('3 × 3 cm',   30,  30,  TRUE, 1),
  ('4 × 4 cm',   40,  40,  TRUE, 2),
  ('5 × 5 cm',   50,  50,  TRUE, 3),
  ('6 × 6 cm',   60,  60,  TRUE, 4),
  ('7 × 7 cm',   70,  70,  TRUE, 5),
  ('8 × 8 cm',   80,  80,  TRUE, 6),
  ('10 × 10 cm', 100, 100, TRUE, 7),
  ('5 × 10 cm',  50,  100, TRUE, 8)
ON CONFLICT DO NOTHING;

-- ─── Seed default materials ──────────────────────────────────────────────────
INSERT INTO "sticker_materials" ("code","name","description","is_waterproof","is_outdoor_compatible","is_transparent","is_premium","price_modifier_type","price_modifier_value","position")
VALUES
  ('vinyl_white',       'Vinyle blanc',        'Résistant, polyvalent, idéal pour la plupart des usages',          TRUE,  TRUE,  FALSE, FALSE, 'multiplier', 1.0,  1),
  ('vinyl_transparent', 'Vinyle transparent',  'Effet discret, parfait sur surfaces vitrées',                      TRUE,  TRUE,  TRUE,  FALSE, 'multiplier', 1.1,  2),
  ('vinyl_holographic', 'Vinyle holographique','Effet premium, reflets colorés irisés',                            TRUE,  FALSE, FALSE, TRUE,  'multiplier', 1.35, 3),
  ('vinyl_glitter',     'Vinyle pailleté',     'Brillant et festif',                                               TRUE,  FALSE, FALSE, TRUE,  'multiplier', 1.25, 4),
  ('vinyl_kraft',       'Papier kraft',        'Aspect naturel et artisanal',                                      FALSE, FALSE, FALSE, FALSE, 'multiplier', 0.9,  5)
ON CONFLICT ("code") DO NOTHING;

-- ─── Seed default laminations ────────────────────────────────────────────────
INSERT INTO "sticker_laminations" ("code","name","description","price_modifier_type","price_modifier_value","is_default","position")
VALUES
  ('none',       'Sans lamination', 'Impression standard sans protection supplémentaire', 'none',       1.0,  TRUE,  1),
  ('gloss',      'Brillant',        'Finition brillante, couleurs vives',                  'multiplier', 1.05, FALSE, 2),
  ('matte',      'Mat',             'Finition mate, aspect haut de gamme',                 'multiplier', 1.10, FALSE, 3),
  ('soft_touch', 'Soft Touch',      'Toucher doux velouté',                               'multiplier', 1.20, FALSE, 4),
  ('uv',         'Vernis UV',       'Protection renforcée UV',                             'multiplier', 1.15, FALSE, 5)
ON CONFLICT ("code") DO NOTHING;

-- ─── Seed default cut types ──────────────────────────────────────────────────
INSERT INTO "sticker_cut_types" ("code","name","description","requires_cut_path","price_modifier_type","price_modifier_value","position")
VALUES
  ('straight_cut', 'Découpe droite',    'Découpe rectangulaire simple, rapide et économique', FALSE, 'none',       1.0,  1),
  ('die_cut',      'Découpe à la forme','Suit exactement les contours de votre visuel',        TRUE,  'multiplier', 1.15, 2),
  ('kiss_cut',     'Mi-chair',          'Découpe le sticker, le support reste intact',         FALSE, 'multiplier', 1.10, 3),
  ('through_cut',  'Pleine chair',      'Découpe sticker et support',                          FALSE, 'multiplier', 1.05, 4)
ON CONFLICT ("code") DO NOTHING;
