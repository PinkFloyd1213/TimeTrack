-- ============================================================================
-- Migration 1.6 — A appliquer une seule fois sur la base de prod existante.
--
-- Resume des changements de la 1.6 :
--   * "Se souvenir de moi" sur l'ecran de connexion → frontend uniquement,
--     aucune modification de schema necessaire.
--   * Theme personnalisable (clair / sombre / custom) avec presets et reglages
--     de couleurs par utilisateur → ajoute les colonnes ci-dessous.
--
-- Usage :
--   mysql -u <user> -p <database> < db/migrations/migration_1.6.sql
-- ============================================================================

ALTER TABLE `user_preferences`
  ADD COLUMN `theme_mode` ENUM('light','dark','custom') NOT NULL DEFAULT 'light' AFTER `overtime_period`,
  ADD COLUMN `theme_primary` VARCHAR(7) DEFAULT '#3b82f6' AFTER `theme_mode`,
  ADD COLUMN `theme_secondary` VARCHAR(7) DEFAULT '#9333ea' AFTER `theme_primary`,
  ADD COLUMN `theme_accent` VARCHAR(7) DEFAULT '#06b6d4' AFTER `theme_secondary`,
  ADD COLUMN `theme_use_gradient` TINYINT(1) NOT NULL DEFAULT 1 AFTER `theme_accent`,
  ADD COLUMN `theme_app_bg` VARCHAR(7) DEFAULT NULL AFTER `theme_use_gradient`,
  ADD COLUMN `theme_surface_bg` VARCHAR(7) DEFAULT NULL AFTER `theme_app_bg`,
  ADD COLUMN `theme_text_color` VARCHAR(7) DEFAULT NULL AFTER `theme_surface_bg`,
  ADD COLUMN `theme_highlight_bg` VARCHAR(7) DEFAULT NULL AFTER `theme_text_color`;

-- Reprend l'etat actuel du toggle dark_mode pour les utilisateurs existants
UPDATE `user_preferences` SET `theme_mode` = IF(`dark_mode` = 1, 'dark', 'light');
