-- 0029 — Prix fixe optionnel par taille (sticker_sizes)
-- Quand price_cents est défini, il est utilisé comme prix de base
-- à la place du calcul au cm² ou du prix unitaire produit.

ALTER TABLE "sticker_sizes"
  ADD COLUMN IF NOT EXISTS "price_cents" INTEGER;
