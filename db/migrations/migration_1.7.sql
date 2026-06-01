-- ============================================================================
-- Migration 1.7 — A appliquer une seule fois sur la base de prod existante.
--
-- Resume des changements de la 1.7 :
--   * Horaires de travail variables par jour de la semaine (temps partiel).
--     Ajoute un interrupteur `use_custom_schedule` et un tableau JSON de 7
--     valeurs `work_hours_by_day` (Lun→Dim). Quand l'interrupteur est a 0,
--     on retombe sur `required_work_hours` → aucun changement pour l'existant.
--
-- Usage :
--   mysql -u <user> -p <database> < db/migrations/migration_1.7.sql
-- ============================================================================

ALTER TABLE `user_preferences`
  ADD COLUMN `use_custom_schedule` BOOLEAN DEFAULT FALSE AFTER `required_work_hours`,
  ADD COLUMN `work_hours_by_day` TEXT DEFAULT NULL AFTER `use_custom_schedule`;
