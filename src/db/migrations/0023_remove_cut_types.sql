-- 0023 — Suppression des types de découpe (redondant avec les formes)

ALTER TABLE "product_sticker_configs" DROP COLUMN IF EXISTS "enabled_cut_type_ids";
ALTER TABLE "product_sticker_configs" DROP COLUMN IF EXISTS "default_cut_type_id";

DROP TABLE IF EXISTS "sticker_cut_types" CASCADE;
