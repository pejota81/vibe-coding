const db = require('../config/database');

function findAll() {
  return db.prepare('SELECT * FROM roles ORDER BY id').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
}

function findByName(name) {
  return db.prepare('SELECT * FROM roles WHERE name = ?').get(name);
}

function create({ name, description = '', show_personal_info = 1, show_social_media = 1, show_connected_accounts = 1 }) {
  const result = db.prepare(
    'INSERT INTO roles (name, description, show_personal_info, show_social_media, show_connected_accounts) VALUES (?, ?, ?, ?, ?)'
  ).run(name, description, show_personal_info ? 1 : 0, show_social_media ? 1 : 0, show_connected_accounts ? 1 : 0);
  return findById(result.lastInsertRowid);
}

function getSectionVisibility(roleName) {
  const row = db.prepare('SELECT show_personal_info, show_social_media, show_connected_accounts FROM roles WHERE name = ?').get(roleName || '');
  return {
    show_personal_info: !!row?.show_personal_info,
    show_social_media: !!row?.show_social_media,
    show_connected_accounts: !!row?.show_connected_accounts
  };
}

function update(id, { name, description, show_personal_info, show_social_media, show_connected_accounts }) {
  const role = findById(id);
  if (!role) return null;
  const newName = name ?? role.name;
  const newDesc = description ?? role.description;
  const newShowPersonalInfo = show_personal_info !== undefined ? (show_personal_info ? 1 : 0) : role.show_personal_info;
  const newShowSocialMedia = show_social_media !== undefined ? (show_social_media ? 1 : 0) : role.show_social_media;
  const newShowConnectedAccounts = show_connected_accounts !== undefined ? (show_connected_accounts ? 1 : 0) : role.show_connected_accounts;
  db.prepare('UPDATE roles SET name = ?, description = ?, show_personal_info = ?, show_social_media = ?, show_connected_accounts = ? WHERE id = ?')
    .run(newName, newDesc, newShowPersonalInfo, newShowSocialMedia, newShowConnectedAccounts, id);
  return findById(id);
}

function deleteRole(id) {
  const role = findById(id);
  if (!role) return { success: false, message: 'Role not found' };
  if (role.protected) return { success: false, message: `The "${role.name}" role is built-in and cannot be deleted` };

  // Re-assign users that had this role to 'user'
  db.prepare("UPDATE users SET role = 'user' WHERE role = ?").run(role.name);
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  return { success: true };
}

function findAllPermissions() {
  return db.prepare('SELECT * FROM permissions ORDER BY id').all();
}

function getPermissions(roleId) {
  return db.prepare(
    `SELECT p.* FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = ?`
  ).all(roleId);
}

function setPermissions(roleId, permissionIds) {
  const del = db.prepare('DELETE FROM role_permissions WHERE role_id = ?');
  const ins = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  const tx = db.transaction((ids) => {
    del.run(roleId);
    for (const pid of ids) {
      ins.run(roleId, pid);
    }
  });
  tx(permissionIds || []);
}

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  delete: deleteRole,
  findAllPermissions,
  getPermissions,
  setPermissions,
  getSectionVisibility,
};
