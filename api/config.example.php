<?php
/**
 * Configuration base de données MySQL.
 * Copier ce fichier en config.php et renseigner les valeurs.
 * config.php est dans .gitignore — ne jamais le committer.
 */

define('DB_HOST',    getenv('DB_HOST') ?: 'localhost');
define('DB_PORT',    (int)(getenv('DB_PORT') ?: 3306));
define('DB_NAME',    getenv('DB_NAME') ?: 'timetrack');
define('DB_USER',    getenv('DB_USER') ?: 'db_user');
define('DB_PASS',    getenv('DB_PASS') ?: 'db_password');
define('DB_CHARSET', 'utf8mb4');

// Origins autorisés pour le CORS (séparés par des virgules)
define('ALLOWED_ORIGINS', getenv('ALLOWED_ORIGINS') ?: 'http://localhost:5173,https://votre-domaine.com');
