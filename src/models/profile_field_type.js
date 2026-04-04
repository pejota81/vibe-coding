const db = require('../config/database');

function findAll() {
  return db.prepare('SELECT id, name, input_type, placeholder, is_mandatory, sort_order, created_at FROM profile_field_types ORDER BY sort_order, id').all();
}

function findById(id) {
  return db.prepare('SELECT id, name, input_type, placeholder, is_mandatory, sort_order, created_at FROM profile_field_types WHERE id = ?').get(id);
}

function create({ name, input_type = 'text', placeholder = '', is_mandatory = 0, sort_order = 0 }) {
  const result = db.prepare(
    'INSERT INTO profile_field_types (name, input_type, placeholder, is_mandatory, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(name, input_type, placeholder, is_mandatory ? 1 : 0, sort_order);
  return findById(result.lastInsertRowid);
}

function update(id, { name, input_type, placeholder, is_mandatory, sort_order }) {
  const field = findById(id);
  if (!field) return null;
  db.prepare(
    'UPDATE profile_field_types SET name = ?, input_type = ?, placeholder = ?, is_mandatory = ?, sort_order = ? WHERE id = ?'
  ).run(
    name ?? field.name,
    input_type ?? field.input_type,
    placeholder ?? field.placeholder,
    is_mandatory !== undefined ? (is_mandatory ? 1 : 0) : field.is_mandatory,
    sort_order ?? field.sort_order,
    id
  );
  return findById(id);
}

function deleteField(id) {
  const field = findById(id);
  if (!field) return { success: false, message: 'Field not found' };
  db.prepare('DELETE FROM profile_field_types WHERE id = ?').run(id);
  return { success: true };
}

function getUserProfileFields(userId) {
  return db.prepare('SELECT field_type_id, value FROM user_profile_fields WHERE user_id = ?').all(userId);
}

function upsertUserProfileFields(userId, fields) {
  const upsert = db.prepare(
    'INSERT INTO user_profile_fields (user_id, field_type_id, value) VALUES (?, ?, ?) ON CONFLICT(user_id, field_type_id) DO UPDATE SET value = excluded.value'
  );
  const remove = db.prepare('DELETE FROM user_profile_fields WHERE user_id = ? AND field_type_id = ?');

  for (const { field_type_id, value } of fields) {
    if (value && value.trim()) {
      upsert.run(userId, field_type_id, value.trim());
    } else {
      remove.run(userId, field_type_id);
    }
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: deleteField,
  getUserProfileFields,
  upsertUserProfileFields
};
