const db = require('../config/database');

function findAll() {
  return db.prepare('SELECT id, name, placeholder, sort_order, created_at FROM social_platforms ORDER BY sort_order, id').all();
}

function findById(id) {
  return db.prepare('SELECT id, name, placeholder, sort_order, created_at FROM social_platforms WHERE id = ?').get(id);
}

function create({ name, placeholder = '', sort_order = 0 }) {
  const result = db.prepare(
    'INSERT INTO social_platforms (name, placeholder, sort_order) VALUES (?, ?, ?)'
  ).run(name, placeholder, sort_order);
  return findById(result.lastInsertRowid);
}

function update(id, { name, placeholder, sort_order }) {
  const platform = findById(id);
  if (!platform) return null;
  db.prepare(
    'UPDATE social_platforms SET name = ?, placeholder = ?, sort_order = ? WHERE id = ?'
  ).run(name ?? platform.name, placeholder ?? platform.placeholder, sort_order ?? platform.sort_order, id);
  return findById(id);
}

function deletePlatform(id) {
  const platform = findById(id);
  if (!platform) return { success: false, message: 'Platform not found' };
  db.prepare('DELETE FROM social_platforms WHERE id = ?').run(id);
  return { success: true };
}

function getUserSocialLinks(userId) {
  return db.prepare('SELECT platform_id, value FROM user_social_links WHERE user_id = ?').all(userId);
}

function upsertUserSocialLinks(userId, links) {
  const upsert = db.prepare(
    'INSERT INTO user_social_links (user_id, platform_id, value) VALUES (?, ?, ?) ON CONFLICT(user_id, platform_id) DO UPDATE SET value = excluded.value'
  );
  const remove = db.prepare('DELETE FROM user_social_links WHERE user_id = ? AND platform_id = ?');

  for (const { platform_id, value } of links) {
    if (value && value.trim()) {
      upsert.run(userId, platform_id, value.trim());
    } else {
      remove.run(userId, platform_id);
    }
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: deletePlatform,
  getUserSocialLinks,
  upsertUserSocialLinks
};
