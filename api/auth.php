<?php
/**
 * Endpoint d'authentification.
 *
 * POST /api/auth.php
 * Body JSON : { "action": "login|register|logout|session|update_password", ...params }
 *
 * Actions :
 *   login            { username, password }
 *   register         { username, password }
 *   logout           {}
 *   session          {}  → renvoie l'utilisateur courant ou null
 *   update_password  { password }
 */

require_once __DIR__ . '/helpers.php';
cors();

header('Content-Type: application/json; charset=utf-8');

$body   = get_body();
$action = $body['action'] ?? '';

switch ($action) {

    // ── GET SESSION ──────────────────────────────────────────────────────────
    case 'session':
        start_session();
        if (empty($_SESSION['user_id'])) {
            json_ok(null);
        }
        $user = fetch_user_by_id($_SESSION['user_id']);
        json_ok($user);

    // ── LOGIN ────────────────────────────────────────────────────────────────
    case 'login':
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (strlen($username) < 2) {
            json_error("Le nom d'utilisateur doit contenir au moins 2 caractères");
        }
        if (strlen($password) < 6) {
            json_error('Le mot de passe doit contenir au moins 6 caractères');
        }

        $db  = get_db();
        $stmt = $db->prepare('SELECT id, username, password_hash, created_at FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $row = $stmt->fetch();

        if (!$row || !password_verify($password, $row['password_hash'])) {
            json_error("Nom d'utilisateur ou mot de passe incorrect");
        }

        start_session();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $row['id'];

        json_ok([
            'id'         => $row['id'],
            'username'   => $row['username'],
            'created_at' => to_iso($row['created_at']),
        ]);

    // ── REGISTER ─────────────────────────────────────────────────────────────
    case 'register':
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (strlen($username) < 2) {
            json_error("Le nom d'utilisateur doit contenir au moins 2 caractères");
        }
        if (strlen($username) > 50) {
            json_error("Le nom d'utilisateur ne peut pas dépasser 50 caractères");
        }
        if (strlen($password) < 6) {
            json_error('Le mot de passe doit contenir au moins 6 caractères');
        }

        $db = get_db();

        // Vérifier unicité
        $stmt = $db->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            json_error("Ce nom d'utilisateur existe déjà");
        }

        $userId       = generate_uuid();
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $db->beginTransaction();
        try {
            $db->prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
               ->execute([$userId, $username, $passwordHash]);

            $prefId = generate_uuid();
            $db->prepare(
                'INSERT INTO user_preferences
                 (id, user_id, dark_mode, notifications_enabled, required_work_hours, required_lunch_break_minutes,
                  end_of_day_threshold, weekly_overtime_minutes, use_overtime_compensation,
                  minimum_end_time, use_minimum_end_time)
                 VALUES (?, ?, 0, 0, 8.0, 30, 0.80, 0, 0, NULL, 1)'
            )->execute([$prefId, $userId]);

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            json_error('Erreur lors de la création du compte', 500);
        }

        start_session();
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;

        $stmt = $db->prepare('SELECT id, username, created_at FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        json_ok([
            'id'         => $user['id'],
            'username'   => $user['username'],
            'created_at' => to_iso($user['created_at']),
        ]);

    // ── LOGOUT ───────────────────────────────────────────────────────────────
    case 'logout':
        start_session();
        $_SESSION = [];
        session_destroy();
        json_ok(null);

    // ── UPDATE PASSWORD ──────────────────────────────────────────────────────
    case 'update_password':
        $userId   = require_auth();
        $password = $body['password'] ?? '';

        if (strlen($password) < 6) {
            json_error('Le mot de passe doit contenir au moins 6 caractères');
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $db   = get_db();
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
           ->execute([$hash, $userId]);

        json_ok(null);

    default:
        json_error('Action inconnue', 400);
}

// ─── Helpers locaux ──────────────────────────────────────────────────────────

function fetch_user_by_id(string $id): ?array
{
    $db   = get_db();
    $stmt = $db->prepare('SELECT id, username, created_at FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    return [
        'id'         => $row['id'],
        'username'   => $row['username'],
        'created_at' => to_iso($row['created_at']),
    ];
}
