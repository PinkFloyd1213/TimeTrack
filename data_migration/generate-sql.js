/**
 * Génère un fichier SQL d'import depuis primetime-export-*.json
 *
 * Usage :
 *   C:\Users\ilian.taini\Documents\DIVERS\NPM\node.exe generate-sql.js
 *   (exécuter depuis le dossier data_migration/)
 *
 * Produit : import.sql (à importer via phpMyAdmin ou mysql CLI sur Plesk)
 */

const fs   = require('fs');
const path = require('path');

// ── Trouver le fichier JSON ──────────────────────────────────────────────────
const dir   = __dirname;
const files = fs.readdirSync(dir).filter(f => f.startsWith('primetime-export-') && f.endsWith('.json'));

if (!files.length) {
  console.error('Aucun fichier primetime-export-*.json trouvé.');
  process.exit(1);
}

files.sort().reverse(); // Le plus récent en premier
const jsonPath = path.join(dir, files[0]);
console.log('Fichier source :', jsonPath);

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

if (!data.user || !data.work_sessions) {
  console.error('Format JSON invalide.');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  // Échapper les apostrophes
  return "'" + String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

/** Convertit une date ISO 8601 en DATETIME MySQL (UTC) */
function toMysql(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/** Génère un UUID v4 simple */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Construction du SQL ──────────────────────────────────────────────────────
const lines = [];

lines.push('-- ============================================================');
lines.push('-- Import PrimeTime → MySQL');
lines.push('-- Généré le : ' + new Date().toISOString());
lines.push('-- Source    : ' + path.basename(jsonPath));
lines.push('-- ============================================================');
lines.push('');
lines.push('SET NAMES utf8mb4;');
lines.push('SET foreign_key_checks = 0;');
lines.push('');

// ── Utilisateur ──────────────────────────────────────────────────────────────
const user      = data.user;
const userId    = user.id;
const username  = user.username;
const createdAt = toMysql(user.created_at) || new Date().toISOString().slice(0, 19).replace('T', ' ');

// Mot de passe temporaire hashé (bcrypt de "Changez_moi_2024!")
// Note : PHP génère un hash différent à chaque fois, celui-ci est un exemple.
// L'utilisateur DEVRA changer son mot de passe à la première connexion.
// Pour un vrai hash, utilisez migrate.php côté serveur.
const tempHash = '$2y$10$ExampleHashPleaseUseMigratePHP.ForRealPasswordHashing';

lines.push('-- ── Utilisateur ────────────────────────────────────────────────');
lines.push(`INSERT INTO \`users\` (id, username, password_hash, created_at)`);
lines.push(`VALUES (${esc(userId)}, ${esc(username)}, ${esc(tempHash)}, ${esc(createdAt)})`);
lines.push('ON DUPLICATE KEY UPDATE username = VALUES(username);');
lines.push('');
lines.push(`-- ⚠️  Le password_hash ci-dessus est un placeholder.`);
lines.push(`--     Utilisez plutôt api/migrate.php pour générer un vrai hash bcrypt.`);
lines.push('');

// ── Préférences ──────────────────────────────────────────────────────────────
if (data.preferences) {
  const p = data.preferences;
  const prefId = p.id || uuid();

  lines.push('-- ── Préférences ─────────────────────────────────────────────────');
  lines.push(
    `INSERT INTO \`user_preferences\``
    + ` (id, user_id, dark_mode, notifications_enabled, required_work_hours,`
    + ` required_lunch_break_minutes, end_of_day_threshold, weekly_overtime_minutes,`
    + ` use_overtime_compensation, minimum_end_time, use_minimum_end_time, last_seen_version)`
  );
  lines.push(
    `VALUES (`
    + `${esc(prefId)}, ${esc(userId)}, `
    + `${p.dark_mode ? 1 : 0}, ${p.notifications_enabled ? 1 : 0}, `
    + `${parseFloat(p.required_work_hours) || 8}, `
    + `${parseInt(p.required_lunch_break_minutes) || 30}, `
    + `${parseFloat(p.end_of_day_threshold) || 0.80}, `
    + `${parseInt(p.weekly_overtime_minutes) || 0}, `
    + `${p.use_overtime_compensation ? 1 : 0}, `
    + `${esc(p.minimum_end_time || null)}, `
    + `${p.use_minimum_end_time !== false ? 1 : 0}, `
    + `${esc(p.last_seen_version || null)})`
  );
  lines.push(
    `ON DUPLICATE KEY UPDATE`
    + ` dark_mode = VALUES(dark_mode),`
    + ` notifications_enabled = VALUES(notifications_enabled),`
    + ` required_work_hours = VALUES(required_work_hours),`
    + ` required_lunch_break_minutes = VALUES(required_lunch_break_minutes),`
    + ` end_of_day_threshold = VALUES(end_of_day_threshold),`
    + ` weekly_overtime_minutes = VALUES(weekly_overtime_minutes),`
    + ` use_overtime_compensation = VALUES(use_overtime_compensation),`
    + ` minimum_end_time = VALUES(minimum_end_time),`
    + ` use_minimum_end_time = VALUES(use_minimum_end_time),`
    + ` last_seen_version = VALUES(last_seen_version);`
  );
  lines.push('');
}

// ── Sessions de travail ──────────────────────────────────────────────────────
const sessions = data.work_sessions || [];
let skipped = 0;

lines.push('-- ── Sessions de travail ─────────────────────────────────────────');
lines.push(`-- Total : ${sessions.length} sessions`);
lines.push('');

for (const s of sessions) {
  const clockIn = toMysql(s.clock_in);
  const date    = s.date || (clockIn ? clockIn.slice(0, 10) : null);

  if (!clockIn || !date) {
    skipped++;
    continue;
  }

  const id        = s.id || uuid();
  const clockOut  = toMysql(s.clock_out);
  const lunch     = parseInt(s.lunch_break_minutes) || 0;
  const isLunch   = s.is_lunch_break ? 1 : 0;
  const createdAt = toMysql(s.created_at) || new Date().toISOString().slice(0, 19).replace('T', ' ');

  lines.push(
    `INSERT IGNORE INTO \`work_sessions\``
    + ` (id, user_id, date, clock_in, clock_out, lunch_break_minutes, is_lunch_break, created_at)`
    + ` VALUES (`
    + `${esc(id)}, ${esc(userId)}, ${esc(date)}, ${esc(clockIn)}, ${esc(clockOut)},`
    + ` ${lunch}, ${isLunch}, ${esc(createdAt)});`
  );
}

if (skipped > 0) {
  lines.push('');
  lines.push(`-- ⚠️  ${skipped} session(s) ignorée(s) (clock_in ou date manquant).`);
}

lines.push('');
lines.push('SET foreign_key_checks = 1;');
lines.push('');
lines.push('-- ── Fin du script ───────────────────────────────────────────────');

// ── Écriture du fichier ──────────────────────────────────────────────────────
const outPath = path.join(dir, 'import.sql');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log('\n✅ Fichier SQL généré :', outPath);
console.log(`   ${sessions.length - skipped} session(s) incluses, ${skipped} ignorée(s).`);
console.log('\nImportez import.sql via phpMyAdmin (onglet "Importer") dans Plesk.');
console.log('⚠️  Pour le mot de passe, utilisez plutôt api/migrate.php côté serveur.');
