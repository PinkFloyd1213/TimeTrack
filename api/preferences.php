<?php
/**
 * CRUD pour la table user_preferences.
 *
 * POST /api/preferences.php
 * Body JSON : { "action": "select|insert|update|delete", ...params }
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
        $maybeSingle = !empty($body['maybe_single']);

        $stmt = $db->prepare('SELECT * FROM user_preferences WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if ($maybeSingle) {
            json_ok($row ? cast_prefs($row) : null);
        }
        json_ok($row ? [cast_prefs($row)] : []);
    }

    // ── INSERT ───────────────────────────────────────────────────────────────
    case 'insert': {
        $data = $body['data'] ?? [];
        if (!isset($data[0])) $data = [$data];

        foreach ($data as $row) {
            $id = $row['id'] ?? generate_uuid();
            $db->prepare(
                'INSERT IGNORE INTO user_preferences
                 (id, user_id, dark_mode, notifications_enabled, required_work_hours,
                  required_lunch_break_minutes, end_of_day_threshold, weekly_overtime_minutes,
                  use_overtime_compensation, minimum_end_time, use_minimum_end_time, last_seen_version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $id,
                $userId,
                !empty($row['dark_mode']) ? 1 : 0,
                !empty($row['notifications_enabled']) ? 1 : 0,
                (float)($row['required_work_hours'] ?? 8.0),
                (int)($row['required_lunch_break_minutes'] ?? 30),
                (float)($row['end_of_day_threshold'] ?? 0.80),
                (int)($row['weekly_overtime_minutes'] ?? 0),
                !empty($row['use_overtime_compensation']) ? 1 : 0,
                $row['minimum_end_time'] ?? null,
                isset($row['use_minimum_end_time']) ? (!empty($row['use_minimum_end_time']) ? 1 : 0) : 1,
                $row['last_seen_version'] ?? null,
            ]);
        }

        json_ok(null);
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    case 'update': {
        $data = $body['data'] ?? [];

        if (empty($data)) {
            json_error('Aucune donnée à mettre à jour');
        }

        $validPeriods = ['week', 'month', 'quarter', 'semester', 'year', 'lifetime'];
        if (isset($data['overtime_period']) && !in_array($data['overtime_period'], $validPeriods, true)) {
            json_error('Valeur overtime_period invalide', 400);
        }

        $validThemeModes = ['light', 'dark', 'custom'];
        if (isset($data['theme_mode']) && !in_array($data['theme_mode'], $validThemeModes, true)) {
            json_error('Valeur theme_mode invalide', 400);
        }

        $hexFields = ['theme_primary', 'theme_secondary', 'theme_accent', 'theme_app_bg', 'theme_surface_bg', 'theme_text_color', 'theme_highlight_bg'];
        foreach ($hexFields as $hf) {
            if (isset($data[$hf]) && $data[$hf] !== null && !preg_match('/^#[0-9a-fA-F]{6}$/', $data[$hf])) {
                json_error("Valeur $hf invalide", 400);
            }
        }

        // Horaires par jour (1.7) : tableau de 7 nombres >= 0, ou null.
        if (isset($data['work_hours_by_day']) && $data['work_hours_by_day'] !== null) {
            $sched = $data['work_hours_by_day'];
            if (!is_array($sched) || count($sched) !== 7) {
                json_error('work_hours_by_day doit comporter 7 valeurs', 400);
            }
            foreach ($sched as $h) {
                if (!is_numeric($h) || $h < 0) {
                    json_error('Valeur work_hours_by_day invalide', 400);
                }
            }
        }

        // Pause de midi par jour (1.7.1) : tableau de 7 booleens, ou null.
        if (isset($data['no_lunch_break_by_day']) && $data['no_lunch_break_by_day'] !== null) {
            $noLunch = $data['no_lunch_break_by_day'];
            if (!is_array($noLunch) || count($noLunch) !== 7) {
                json_error('no_lunch_break_by_day doit comporter 7 valeurs', 400);
            }
        }

        $allowed = [
            'dark_mode', 'notifications_enabled', 'required_work_hours',
            'required_lunch_break_minutes', 'end_of_day_threshold',
            'weekly_overtime_minutes', 'use_overtime_compensation',
            'minimum_end_time', 'use_minimum_end_time', 'last_seen_version',
            'overtime_period', 'use_custom_schedule', 'work_hours_by_day', 'no_lunch_break_by_day',
            'theme_mode', 'theme_primary', 'theme_secondary', 'theme_accent',
            'theme_use_gradient', 'theme_app_bg', 'theme_surface_bg', 'theme_text_color', 'theme_highlight_bg',
        ];
        $bools = [
            'dark_mode', 'notifications_enabled',
            'use_overtime_compensation', 'use_minimum_end_time',
            'theme_use_gradient', 'use_custom_schedule',
        ];

        $setClauses = [];
        $setParams  = [];

        foreach ($data as $col => $val) {
            if (!in_array($col, $allowed, true)) continue;
            if (in_array($col, $bools, true)) {
                $val = $val ? 1 : 0;
            } elseif ($col === 'work_hours_by_day') {
                // Tableau → JSON (ou NULL si non fourni)
                $val = is_array($val) ? json_encode(array_map('floatval', $val)) : null;
            } elseif ($col === 'no_lunch_break_by_day') {
                // Tableau de booleens → JSON (ou NULL si non fourni)
                $val = is_array($val) ? json_encode(array_map('boolval', $val)) : null;
            }
            $setClauses[] = "`$col` = ?";
            $setParams[]  = $val;
        }

        if (empty($setClauses)) {
            json_error('Aucun champ valide à mettre à jour');
        }

        $sql  = 'UPDATE user_preferences SET ' . implode(', ', $setClauses) . ' WHERE user_id = ?';
        $stmt = $db->prepare($sql);
        $stmt->execute([...$setParams, $userId]);

        json_ok(null);
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    case 'delete': {
        $db->prepare('DELETE FROM user_preferences WHERE user_id = ?')->execute([$userId]);
        json_ok(null);
    }

    default:
        json_error('Action inconnue', 400);
}
