<?php
/**
 * Script de migration : importe un fichier JSON PrimeTime dans MySQL.
 *
 * USAGE (à exécuter depuis le navigateur ou curl sur le serveur Plesk) :
 *   GET  /api/migrate.php?token=VOTRE_TOKEN_SECRET
 *
 * Ce script lit le fichier data_migration/timetrack-export-*.json
 * et insère les données dans les tables users, user_preferences et work_sessions.
 *
 * ⚠️  SUPPRIMEZ ou DÉSACTIVEZ ce fichier après utilisation !
 */

// ── Jeton de sécurité ────────────────────────────────────────────────────────
// Changez cette valeur avant de déployer, puis passez ?token=... dans l'URL.
define('MIGRATE_TOKEN', 'CHANGEZ_CE_TOKEN_SECRET');

if (($_GET['token'] ?? '') !== MIGRATE_TOKEN) {
    http_response_code(403);
    exit('Accès refusé – fournissez ?token=... correct.');
}

require_once __DIR__ . '/helpers.php';

header('Content-Type: text/plain; charset=utf-8');

// ── Trouver le fichier JSON ──────────────────────────────────────────────────
$dataDir = __DIR__ . '/../data_migration';
$files   = glob("$dataDir/timetrack-export-*.json");

if (empty($files)) {
    exit("Aucun fichier timetrack-export-*.json trouvé dans data_migration/");
}

// Prendre le plus récent
usort($files, fn($a, $b) => filemtime($b) - filemtime($a));
$jsonPath = $files[0];
echo "Fichier source : $jsonPath\n";

$raw  = file_get_contents($jsonPath);
$data = json_decode($raw, true);

if (!$data || !isset($data['user'], $data['work_sessions'])) {
    exit("Format JSON invalide.");
}

$db = get_db();

// ── Utilisateur ──────────────────────────────────────────────────────────────
$user       = $data['user'];
$userId     = $user['id'];
$username   = $user['username'];
$createdAt  = to_mysql($user['created_at'] ?? null);

echo "\nUtilisateur : $username (ID: $userId)\n";

// Vérifier si l'utilisateur existe
$stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
$stmt->execute([$userId]);
$existing = $stmt->fetch();

if ($existing) {
    echo "Utilisateur déjà présent → ignoré.\n";
} else {
    // On génère un hash temporaire – l'utilisateur devra changer son mot de passe
    $tempHash = password_hash('Changez_moi_2024!', PASSWORD_BCRYPT);
    $db->prepare(
        'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'
    )->execute([$userId, $username, $tempHash, $createdAt]);
    echo "Utilisateur inséré. Mot de passe temporaire : Changez_moi_2024!\n";
    echo "⚠️  Changez le mot de passe dès la première connexion !\n";
}

// ── Préférences ──────────────────────────────────────────────────────────────
if (!empty($data['preferences'])) {
    $prefs = $data['preferences'];

    $stmt = $db->prepare('SELECT id FROM user_preferences WHERE user_id = ?');
    $stmt->execute([$userId]);

    if ($stmt->fetch()) {
        $db->prepare(
            'UPDATE user_preferences SET
               dark_mode = ?, notifications_enabled = ?, required_work_hours = ?,
               required_lunch_break_minutes = ?, end_of_day_threshold = ?,
               weekly_overtime_minutes = ?, use_overtime_compensation = ?,
               minimum_end_time = ?, use_minimum_end_time = ?, last_seen_version = ?
             WHERE user_id = ?'
        )->execute([
            !empty($prefs['dark_mode']) ? 1 : 0,
            !empty($prefs['notifications_enabled']) ? 1 : 0,
            (float)($prefs['required_work_hours'] ?? 8),
            (int)($prefs['required_lunch_break_minutes'] ?? 30),
            (float)($prefs['end_of_day_threshold'] ?? 0.80),
            (int)($prefs['weekly_overtime_minutes'] ?? 0),
            !empty($prefs['use_overtime_compensation']) ? 1 : 0,
            $prefs['minimum_end_time'] ?? null,
            isset($prefs['use_minimum_end_time']) ? (!empty($prefs['use_minimum_end_time']) ? 1 : 0) : 1,
            $prefs['last_seen_version'] ?? null,
            $userId,
        ]);
        echo "Préférences mises à jour.\n";
    } else {
        $prefId = $prefs['id'] ?? generate_uuid();
        $db->prepare(
            'INSERT INTO user_preferences
             (id, user_id, dark_mode, notifications_enabled, required_work_hours,
              required_lunch_break_minutes, end_of_day_threshold, weekly_overtime_minutes,
              use_overtime_compensation, minimum_end_time, use_minimum_end_time, last_seen_version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $prefId, $userId,
            !empty($prefs['dark_mode']) ? 1 : 0,
            !empty($prefs['notifications_enabled']) ? 1 : 0,
            (float)($prefs['required_work_hours'] ?? 8),
            (int)($prefs['required_lunch_break_minutes'] ?? 30),
            (float)($prefs['end_of_day_threshold'] ?? 0.80),
            (int)($prefs['weekly_overtime_minutes'] ?? 0),
            !empty($prefs['use_overtime_compensation']) ? 1 : 0,
            $prefs['minimum_end_time'] ?? null,
            isset($prefs['use_minimum_end_time']) ? (!empty($prefs['use_minimum_end_time']) ? 1 : 0) : 1,
            $prefs['last_seen_version'] ?? null,
        ]);
        echo "Préférences insérées.\n";
    }
} else {
    echo "Aucune préférence dans le JSON.\n";
}

// ── Sessions de travail ──────────────────────────────────────────────────────
$sessions  = $data['work_sessions'] ?? [];
$imported  = 0;
$skipped   = 0;
$errors    = 0;

echo "\nImport de " . count($sessions) . " sessions...\n";

// Charger les clés existantes pour éviter les doublons
$stmt = $db->prepare('SELECT date, clock_in FROM work_sessions WHERE user_id = ?');
$stmt->execute([$userId]);
$existingKeys = [];
foreach ($stmt->fetchAll() as $row) {
    // Normaliser la clé : date + heure UTC tronquée à la minute
    $dtKey = (new DateTime($row['clock_in'], new DateTimeZone('UTC')))->format('Y-m-d H:i');
    $existingKeys["$row[date]_$dtKey"] = true;
}

$insertStmt = $db->prepare(
    'INSERT INTO work_sessions (id, user_id, date, clock_in, clock_out, lunch_break_minutes, is_lunch_break, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);

foreach ($sessions as $i => $s) {
    try {
        $clockInMysql  = to_mysql($s['clock_in'] ?? null);
        $clockOutMysql = to_mysql($s['clock_out'] ?? null);
        $date          = $s['date'] ?? substr($clockInMysql ?? '', 0, 10);

        if (!$clockInMysql || !$date) {
            echo "  Session #$i ignorée : clock_in ou date manquant.\n";
            $errors++;
            continue;
        }

        // Déduplication par date + minute
        $dtKey    = (new DateTime($clockInMysql, new DateTimeZone('UTC')))->format('Y-m-d H:i');
        $dedupKey = "{$date}_{$dtKey}";

        if (isset($existingKeys[$dedupKey])) {
            $skipped++;
            continue;
        }

        $id        = $s['id'] ?? generate_uuid();
        $lunch     = (int)($s['lunch_break_minutes'] ?? 0);
        $isLunch   = !empty($s['is_lunch_break']) ? 1 : 0;
        $createdAt = to_mysql($s['created_at'] ?? null) ?? date('Y-m-d H:i:s');

        $insertStmt->execute([$id, $userId, $date, $clockInMysql, $clockOutMysql, $lunch, $isLunch, $createdAt]);
        $existingKeys[$dedupKey] = true;
        $imported++;
    } catch (Exception $e) {
        echo "  Erreur session #$i : " . $e->getMessage() . "\n";
        $errors++;
    }
}

echo "\nRésultat :\n";
echo "  Importées : $imported\n";
echo "  Ignorées (doublons) : $skipped\n";
echo "  Erreurs : $errors\n";
echo "\n✅ Migration terminée.\n";
echo "⚠️  Supprimez ou renommez ce fichier migrate.php dès maintenant !\n";
