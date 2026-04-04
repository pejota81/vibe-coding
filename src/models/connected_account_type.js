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
  return db.prepare(
    `SELECT uca.id, uca.account_type_id, uca.value, uca.created_at,
            uca.position, cat.name AS account_type_name, cat.placeholder, cat.sort_order
     FROM user_connected_accounts uca
     JOIN connected_account_types cat ON cat.id = uca.account_type_id
     WHERE uca.user_id = ?
     ORDER BY uca.position, cat.sort_order, cat.id, uca.id`
  ).all(userId);
}

function replaceUserConnectedAccounts(userId, accounts) {
  const removeAll = db.prepare('DELETE FROM user_connected_accounts WHERE user_id = ?');
  const insert = db.prepare(
    'INSERT INTO user_connected_accounts (user_id, account_type_id, value, position) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction((entries) => {
    removeAll.run(userId);
    for (let index = 0; index < entries.length; index += 1) {
      const { account_type_id, value } = entries[index];
      if (!value || !String(value).trim()) continue;
      insert.run(userId, account_type_id, String(value).trim(), (index + 1) * 10);
    }
  });

  tx(accounts || []);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: deleteType,
  getUserConnectedAccounts,
  replaceUserConnectedAccounts,
  upsertUserConnectedAccounts: replaceUserConnectedAccounts
};
