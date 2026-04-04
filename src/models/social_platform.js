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
  return db.prepare(
    `SELECT usl.id, usl.platform_id, usl.value, usl.position, usl.created_at,
            sp.name AS platform_name, sp.placeholder, sp.sort_order
     FROM user_social_links usl
     JOIN social_platforms sp ON sp.id = usl.platform_id
     WHERE usl.user_id = ?
     ORDER BY usl.position, sp.sort_order, sp.id, usl.id`
  ).all(userId);
}

function replaceUserSocialLinks(userId, links) {
  const removeAll = db.prepare('DELETE FROM user_social_links WHERE user_id = ?');
  const insert = db.prepare(
    'INSERT INTO user_social_links (user_id, platform_id, value, position) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction((entries) => {
    removeAll.run(userId);
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry.value || !String(entry.value).trim()) continue;
      insert.run(userId, entry.platform_id, String(entry.value).trim(), (index + 1) * 10);
    }
  });

  tx(links || []);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  delete: deletePlatform,
  getUserSocialLinks,
  replaceUserSocialLinks,
  upsertUserSocialLinks: replaceUserSocialLinks
};
