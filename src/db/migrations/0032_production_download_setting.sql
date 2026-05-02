-- 0032 — Toggle back-office : autoriser le téléchargement du fichier de
-- production (PDF 300 dpi avec cut contour spot magenta) depuis l'éditeur,
-- pour permettre à l'équipe de tester les sorties sans passer commande.

ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "enable_production_download" BOOLEAN NOT NULL DEFAULT false;
