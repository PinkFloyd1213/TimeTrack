<?php
/**
 * CRUD pour la table users.
 *
 * POST /api/users.php
 * Body JSON : { "action": "select|update|delete", ...params }
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
        $filters     = $body['filters'] ?? [];
        $columns     = $body['columns'] ?? 'id, username, created_at';
        $maybeSingle = !empty($body['maybe_single']);
        $single      = !empty($body['single']);

        // Colonnes autorisées
        $safe_cols = ['id', 'username', 'created_at'];
        $cols      = ($columns === '*')
            ? implode(', ', $safe_cols)
            : implode(', ', array_filter(
                array_map('trim', explode(',', $columns)),
                fn($c) => in_array($c, $safe_cols, true)
            ));

        if (!$cols) $cols = 'id, username, created_at';

        // Construire WHERE – on n'expose que les lignes de l'utilisateur courant
        // sauf si on cherche par username (vérification d'unicité)
        $where  = [];
        $params = [];

        foreach ($filters as $f) {
            $col = $f['col'] ?? '';
            $op  = $f['op']  ?? 'eq';
            $val = $f['val'] ?? null;

            if ($col === 'id') {
                // Autorisé uniquement si c'est son propre ID
                if ($val !== $userId) {
                    json_error('Accès refusé', 403);
                }
                $where[]  = 'id = ?';
                $params[] = $userId;
            } elseif ($col === 'username') {
                $where[]  = 'username = ?';
                $params[] = $val;
            }
        }

        // Si aucun filtre sur id, forcer l'utilisateur courant
        $hasIdFilter = !empty(array_filter($filters, fn($f) => ($f['col'] ?? '') === 'id'));
        if (!$hasIdFilter && !in_array('username = ?', $where, true)) {
            $where[]  = 'id = ?';
            $params[] = $userId;
        }

        $whereSql = empty($where) ? '1' : implode(' AND ', $where);
        $stmt     = $db->prepare("SELECT $cols FROM users WHERE $whereSql LIMIT 2");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['created_at'] = to_iso($row['created_at'] ?? null);
        }

        if ($single || $maybeSingle) {
            json_ok($rows[0] ?? null);
        }
        json_ok($rows);
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    case 'update': {
        $data    = $body['data'] ?? [];
        $filters = $body['filters'] ?? [];

        // Vérifier que le filtre est sur l'ID de l'utilisateur courant
        $idFilter = array_values(array_filter($filters, fn($f) => ($f['col'] ?? '') === 'id'));
        if (empty($idFilter) || $idFilter[0]['val'] !== $userId) {
            json_error('Accès refusé', 403);
        }

        if (isset($data['username'])) {
            $newUsername = trim($data['username']);

            if (strlen($newUsername) < 2) {
                json_error("Le nom d'utilisateur doit contenir au moins 2 caractères");
            }
            if (strlen($newUsername) > 50) {
                json_error("Le nom d'utilisateur ne peut pas dépasser 50 caractères");
            }

            // Vérifier unicité (exclure soi-même)
            $stmt = $db->prepare('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1');
            $stmt->execute([$newUsername, $userId]);
            if ($stmt->fetch()) {
                json_error("Ce nom d'utilisateur est déjà pris");
            }

            $db->prepare('UPDATE users SET username = ? WHERE id = ?')
               ->execute([$newUsername, $userId]);
        }

        json_ok(null);
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    case 'delete': {
        // Suppression en cascade : work_sessions et user_preferences sont supprimées
        // automatiquement grâce aux ON DELETE CASCADE définis dans db/schema.sql.
        $db->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);
        json_ok(null);
    }

    default:
        json_error('Action inconnue', 400);
}
