-- 0022 — Table product_families administrable

CREATE TABLE IF NOT EXISTS "product_families" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"        VARCHAR(100) NOT NULL UNIQUE,
  "label"       VARCHAR(255) NOT NULL,
  "description" TEXT,
  "icon"        VARCHAR(10),
  "active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed des familles par défaut
INSERT INTO "product_families" ("slug", "label", "icon", "sort_order") VALUES
  ('sticker',   'Sticker personnalisé', '🏷️', 1),
  ('label',     'Étiquette',            '📋', 2),
  ('pack',      'Pack de stickers',     '📦', 3),
  ('accessory', 'Accessoire',           '🎁', 4),
  ('other',     'Autre',                '⚙️', 5)
ON CONFLICT ("slug") DO NOTHING;
