SET NAMES utf8mb4;
SET foreign_key_checks = 0;

-- 1. Table des utilisateurs
--    password_hash remplace auth_email (ancienne colonne Supabase supprimee)
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table des preferences (liee a l'utilisateur)
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `dark_mode` BOOLEAN DEFAULT FALSE,
  `notifications_enabled` BOOLEAN DEFAULT FALSE,
  `required_work_hours` DECIMAL(5,2) DEFAULT 8.00,
  `required_lunch_break_minutes` INT DEFAULT 30,
  `end_of_day_threshold` DECIMAL(4,2) DEFAULT 0.80,
  `weekly_overtime_minutes` INT DEFAULT 0,
  `use_overtime_compensation` BOOLEAN DEFAULT FALSE,
  `minimum_end_time` VARCHAR(5) DEFAULT NULL,
  `use_minimum_end_time` BOOLEAN DEFAULT TRUE,
  `last_seen_version` VARCHAR(20) DEFAULT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_prefs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table des sessions de travail
CREATE TABLE IF NOT EXISTS `work_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `date` DATE NOT NULL,
  `clock_in` DATETIME NOT NULL,
  `clock_out` DATETIME DEFAULT NULL,
  `lunch_break_minutes` INT DEFAULT 0,
  `is_lunch_break` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user_date` (`user_id`, `date`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;
