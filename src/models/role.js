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

function create({ name, description = '' }) {
  const result = db.prepare(
    'INSERT INTO roles (name, description) VALUES (?, ?)'
  ).run(name, description);
  return findById(result.lastInsertRowid);
}

function update(id, { name, description }) {
  const role = findById(id);
  if (!role) return null;
  const newName = name ?? role.name;
  const newDesc = description ?? role.description;
  db.prepare('UPDATE roles SET name = ?, description = ? WHERE id = ?').run(newName, newDesc, id);
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
  setPermissions
};
