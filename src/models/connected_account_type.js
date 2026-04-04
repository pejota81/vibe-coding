const db = require('../config/database');

function findAll() {
  return db.prepare('SELECT id, name, placeholder, sort_order, created_at FROM connected_account_types ORDER BY sort_order, id').all();
}

function findById(id) {
  return db.prepare('SELECT id, name, placeholder, sort_order, created_at FROM connected_account_types WHERE id = ?').get(id);
}

function create({ name, placeholder = '', sort_order = 0 }) {
  const result = db.prepare(
    'INSERT INTO connected_account_types (name, placeholder, sort_order) VALUES (?, ?, ?)'
  ).run(name, placeholder, sort_order);
  return findById(result.lastInsertRowid);
}

function update(id, { name, placeholder, sort_order }) {
  const type = findById(id);
  if (!type) return null;
  db.prepare(
    'UPDATE connected_account_types SET name = ?, placeholder = ?, sort_order = ? WHERE id = ?'
  ).run(name ?? type.name, placeholder ?? type.placeholder, sort_order ?? type.sort_order, id);
  return findById(id);
}

function deleteType(id) {
  const type = findById(id);
  if (!type) return { success: false, message: 'Account type not found' };
  db.prepare('DELETE FROM connected_account_types WHERE id = ?').run(id);
  return { success: true };
}

function getUserConnectedAccounts(userId) {
  return db.prepare('SELECT account_type_id, value FROM user_connected_accounts WHERE user_id = ?').all(userId);
}

function upsertUserConnectedAccounts(userId, accounts) {
  const upsert = db.prepare(
    'INSERT INTO user_connected_accounts (user_id, account_type_id, value) VALUES (?, ?, ?) ON CONFLICT(user_id, account_type_id) DO UPDATE SET value = excluded.value'
  );
  const remove = db.prepare('DELETE FROM user_connected_accounts WHERE user_id = ? AND account_type_id = ?');

  for (const { account_type_id, value } of accounts) {
    if (value && value.trim()) {
      upsert.run(userId, account_type_id, value.trim());
    } else {
      remove.run(userId, account_type_id);
    }
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: deleteType,
  getUserConnectedAccounts,
  upsertUserConnectedAccounts
};
