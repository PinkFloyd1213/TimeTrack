-- ============================================================================
-- Migration 1.7.1 — A appliquer une seule fois sur la base de prod existante.
--
-- Resume des changements de la 1.7.1 :
--   * Pause de midi optionnelle par jour (temps partiel). Ajoute un tableau
--     JSON de 7 booleens `no_lunch_break_by_day` (Lun→Dim). Quand la case
--     d'un jour est cochee, aucune pause dejeuner n'est comptee ce jour-la
--     dans le calcul de l'heure de sortie. NULL → comportement inchange.
--
-- Usage :
--   mysql -u <user> -p <database> < db/migrations/migration_1.7.1.sql
-- ============================================================================

ALTER TABLE `user_preferences`
  ADD COLUMN `no_lunch_break_by_day` TEXT DEFAULT NULL AFTER `work_hours_by_day`;
