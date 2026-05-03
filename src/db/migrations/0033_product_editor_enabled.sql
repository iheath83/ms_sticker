-- 0033 — Toggle par produit : active l'éditeur visuel sur la fiche produit.
-- Lorsque désactivé, le client ne voit pas le bouton « Créer avec l'éditeur
-- visuel » et doit fournir directement un fichier d'impression.

ALTER TABLE "product_sticker_configs"
  ADD COLUMN IF NOT EXISTS "editor_enabled" BOOLEAN NOT NULL DEFAULT false;
