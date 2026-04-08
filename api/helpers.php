<?php
/**
 * Helpers partagés par tous les endpoints de l'API.
 */

require_once __DIR__ . '/config.php';

// ─── CORS ────────────────────────────────────────────────────────────────────

function cors(): void
{
    $allowed = array_map('trim', explode(',', ALLOWED_ORIGINS));
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowed, true)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ─── RÉPONSES JSON ───────────────────────────────────────────────────────────

function json_ok(mixed $data): never
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['data' => $data]);
    exit;
}

function json_error(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message]);
    exit;
}

// ─── BASE DE DONNÉES ─────────────────────────────────────────────────────────

function get_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
        );
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ─── SESSION ─────────────────────────────────────────────────────────────────

function start_session(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function require_auth(): string
{
    start_session();
    if (empty($_SESSION['user_id'])) {
        json_error('Non authentifié', 401);
    }
    return $_SESSION['user_id'];
}

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function generate_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function get_body(): array
{
    $raw = file_get_contents('php://input');
    return json_decode($raw ?: '{}', true) ?? [];
}

/**
 * Convertit une date MySQL (YYYY-MM-DD HH:MM:SS) en ISO 8601 UTC.
 * Retourne null si la valeur est nulle.
 */
function to_iso(?string $dt): ?string
{
    if ($dt === null) return null;
    try {
        $d = new DateTime($dt, new DateTimeZone('UTC'));
        return $d->format('Y-m-d\TH:i:s.000\Z');
    } catch (Exception) {
        return $dt;
    }
}

/**
 * Convertit une date ISO 8601 du frontend en DATETIME MySQL (UTC).
 */
function to_mysql(?string $iso): ?string
{
    if ($iso === null || $iso === '') return null;
    try {
        $d = new DateTime($iso);
        $d->setTimezone(new DateTimeZone('UTC'));
        return $d->format('Y-m-d H:i:s');
    } catch (Exception) {
        return null;
    }
}

/** Caste les champs booléens d'une session de travail. */
function cast_session(array $row): array
{
    $row['is_lunch_break']       = (bool)(int)($row['is_lunch_break'] ?? 0);
    $row['lunch_break_minutes']  = (int)($row['lunch_break_minutes'] ?? 0);
    $row['clock_in']             = to_iso($row['clock_in'] ?? null);
    $row['clock_out']            = to_iso($row['clock_out'] ?? null);
    $row['created_at']           = to_iso($row['created_at'] ?? null);
    return $row;
}

/** Caste les champs booléens des préférences utilisateur. */
function cast_prefs(array $row): array
{
    $bools = [
        'dark_mode', 'notifications_enabled',
        'use_overtime_compensation', 'use_minimum_end_time',
        'theme_use_gradient',
    ];
    foreach ($bools as $f) {
        $row[$f] = (bool)(int)($row[$f] ?? 0);
    }
    $row['theme_mode']       = $row['theme_mode']       ?? 'light';
    $row['theme_primary']    = $row['theme_primary']    ?? '#3b82f6';
    $row['theme_secondary']  = $row['theme_secondary']  ?? '#9333ea';
    $row['theme_accent']     = $row['theme_accent']     ?? '#06b6d4';
    $row['theme_app_bg']     = $row['theme_app_bg']     ?? null;
    $row['theme_surface_bg'] = $row['theme_surface_bg'] ?? null;
    $row['theme_text_color']   = $row['theme_text_color']   ?? null;
    $row['theme_highlight_bg'] = $row['theme_highlight_bg'] ?? null;
    $row['required_work_hours']          = (float)($row['required_work_hours'] ?? 8);
    $row['required_lunch_break_minutes'] = (int)($row['required_lunch_break_minutes'] ?? 30);
    $row['end_of_day_threshold']         = (float)($row['end_of_day_threshold'] ?? 0.8);
    $row['weekly_overtime_minutes']      = (int)($row['weekly_overtime_minutes'] ?? 0);
    $row['updated_at']                   = to_iso($row['updated_at'] ?? null);
    return $row;
}
