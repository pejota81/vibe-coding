const db = require('../config/database');

function get(key) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function set(key, value) {
  db.prepare(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
  ).run(key, value);
}

module.exports = { get, set };
