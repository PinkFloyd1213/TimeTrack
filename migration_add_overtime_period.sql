-- Ajout de la colonne overtime_period à une base existante
ALTER TABLE `user_preferences`
  ADD COLUMN `overtime_period`
    ENUM('week','month','quarter','semester','year','lifetime')
    DEFAULT 'week'
    AFTER `last_seen_version`;
