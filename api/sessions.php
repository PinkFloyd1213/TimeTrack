<?php
/**
 * CRUD pour la table work_sessions.
 *
 * POST /api/sessions.php
 * Body JSON : { "action": "select|insert|update|delete|upsert", ...params }
 *
 * Toutes les routes nécessitent une session PHP active.
 */

require_once __DIR__ . '/helpers.php';
cors();

$userId = require_auth();
$body   = get_body();
$action = $body['action'] ?? 'select';
$db     = get_db();

switch ($action) {

    // ── SELECT ───────────────────────────────────────────────────────────────
    case 'select': {
        $filters = $body['filters'] ?? [];
        $orders  = $body['orders']  ?? [];

        [$where, $params] = build_where($filters, $userId);

        $orderSql = build_order($orders);

        $sql  = "SELECT * FROM work_sessions WHERE $where $orderSql";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map('cast_session', $stmt->fetchAll());

        $single      = !empty($body['single']);
        $maybeSingle = !empty($body['maybe_single']);

        if ($single || $maybeSingle) {
            json_ok($rows[0] ?? null);
        }
        json_ok($rows);
    }

    // ── INSERT ───────────────────────────────────────────────────────────────
    case 'insert': {
        $data = $body['data'] ?? [];
        // Normaliser : tableau d'objets ou objet simple
        if (!isset($data[0])) {
            $data = [$data];
        }

        $insertedId = null;
        foreach ($data as $row) {
            $id       = $row['id'] ?? generate_uuid();
            $date     = $row['date'] ?? null;
            $clockIn  = to_mysql($row['clock_in'] ?? null);
            $clockOut = to_mysql($row['clock_out'] ?? null);
            $lunch    = (int)($row['lunch_break_minutes'] ?? 0);
            $isLunch  = !empty($row['is_lunch_break']) ? 1 : 0;

            $db->prepare(
                'INSERT INTO work_sessions (id, user_id, date, clock_in, clock_out, lunch_break_minutes, is_lunch_break)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$id, $userId, $date, $clockIn, $clockOut, $lunch, $isLunch]);

            $insertedId = $id;
        }

        // Retourner la dernière session insérée si demandé
        $returnData = !empty($body['return_data']) || !empty($body['single']);
        if ($returnData && $insertedId) {
            $stmt = $db->prepare('SELECT * FROM work_sessions WHERE id = ?');
            $stmt->execute([$insertedId]);
            $row = $stmt->fetch();
            json_ok($row ? cast_session($row) : null);
        }

        json_ok(null);
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    case 'update': {
        $data    = $body['data'] ?? [];
        $filters = $body['filters'] ?? [];

        if (empty($data)) {
            json_error('Aucune donnée à mettre à jour');
        }

        [$where, $params] = build_where($filters, $userId);

        // Construire SET
        $setClauses = [];
        $setParams  = [];
        $allowed    = ['clock_in', 'clock_out', 'lunch_break_minutes', 'is_lunch_break', 'date'];
        foreach ($data as $col => $val) {
            if (!in_array($col, $allowed, true)) continue;
            if ($col === 'clock_in' || $col === 'clock_out') {
                $val = to_mysql($val);
            }
            $setClauses[] = "`$col` = ?";
            $setParams[]  = $val;
        }

        if (empty($setClauses)) {
            json_error('Aucun champ valide à mettre à jour');
        }

        $sql  = 'UPDATE work_sessions SET ' . implode(', ', $setClauses) . " WHERE $where";
        $stmt = $db->prepare($sql);
        $stmt->execute([...$setParams, ...$params]);

        json_ok(null);
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    case 'delete': {
        $filters = $body['filters'] ?? [];

        [$where, $params] = build_where($filters, $userId);

        $db->prepare("DELETE FROM work_sessions WHERE $where")->execute($params);
        json_ok(null);
    }

    // ── UPSERT ───────────────────────────────────────────────────────────────
    case 'upsert': {
        $data = $body['data'] ?? [];
        if (!isset($data[0])) {
            $data = [$data];
        }

        $stmt = $db->prepare(
            'INSERT INTO work_sessions (id, user_id, date, clock_in, clock_out, lunch_break_minutes, is_lunch_break)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               clock_in  = VALUES(clock_in),
               clock_out = VALUES(clock_out),
               lunch_break_minutes = VALUES(lunch_break_minutes),
               is_lunch_break = VALUES(is_lunch_break)'
        );

        foreach ($data as $row) {
            // Vérifier que la session appartient bien à cet utilisateur
            if (!empty($row['id'])) {
                $chk = $db->prepare('SELECT user_id FROM work_sessions WHERE id = ?');
                $chk->execute([$row['id']]);
                $existing = $chk->fetch();
                if ($existing && $existing['user_id'] !== $userId) {
                    json_error('Accès refusé', 403);
                }
            }

            $id       = $row['id'] ?? generate_uuid();
            $date     = $row['date'] ?? null;
            $clockIn  = to_mysql($row['clock_in'] ?? null);
            $clockOut = to_mysql($row['clock_out'] ?? null);
            $lunch    = (int)($row['lunch_break_minutes'] ?? 0);
            $isLunch  = !empty($row['is_lunch_break']) ? 1 : 0;

            $stmt->execute([$id, $userId, $date, $clockIn, $clockOut, $lunch, $isLunch]);
        }

        json_ok(null);
    }

    default:
        json_error('Action inconnue', 400);
}

// ─── Helpers SQL ─────────────────────────────────────────────────────────────

/**
 * Construit la clause WHERE à partir des filtres frontend + sécurité user_id.
 * Retourne [$whereSql, $params].
 */
function build_where(array $filters, string $userId): array
{
    $clauses = ['user_id = ?'];
    $params  = [$userId];

    $allowed_cols = ['id', 'date', 'clock_in', 'clock_out', 'is_lunch_break', 'user_id'];

    foreach ($filters as $f) {
        $col = $f['col'] ?? '';
        $op  = $f['op']  ?? 'eq';
        $val = $f['val'] ?? null;

        // Ignorer user_id (déjà forcé)
        if ($col === 'user_id') continue;
        if (!in_array($col, $allowed_cols, true)) continue;

        switch ($op) {
            case 'eq':
                $clauses[] = "`$col` = ?";
                $params[]  = $val;
                break;
            case 'gt':
                $clauses[] = "`$col` > ?";
                $params[]  = $val;
                break;
            case 'gte':
                $clauses[] = "`$col` >= ?";
                $params[]  = $val;
                break;
            case 'lt':
                $clauses[] = "`$col` < ?";
                $params[]  = $val;
                break;
            case 'lte':
                $clauses[] = "`$col` <= ?";
                $params[]  = $val;
                break;
            case 'in':
                if (!is_array($val) || empty($val)) break;
                // Sécurité : vérifier que les IDs appartiennent à l'utilisateur
                $placeholders = implode(',', array_fill(0, count($val), '?'));
                $clauses[] = "`$col` IN ($placeholders)";
                $params    = [...$params, ...$val];
                break;
        }
    }

    return [implode(' AND ', $clauses), $params];
}

function build_order(array $orders): string
{
    if (empty($orders)) return '';
    $allowed = ['id', 'date', 'clock_in', 'clock_out', 'created_at'];
    $parts   = [];
    foreach ($orders as $o) {
        $col = $o['col'] ?? '';
        if (!in_array($col, $allowed, true)) continue;
        $dir    = ($o['ascending'] ?? true) ? 'ASC' : 'DESC';
        $parts[] = "`$col` $dir";
    }
    return empty($parts) ? '' : 'ORDER BY ' . implode(', ', $parts);
}
