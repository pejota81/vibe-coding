const bcrypt = require('bcryptjs');
const db = require('../config/database');

const SALT_ROUNDS = 10;

function findAll() {
  return db.prepare('SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY id').all();
}

function findById(id) {
  return db.prepare('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?').get(id);
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function create({ username, email, password, role = 'user' }) {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(username, email, hash, role);
  return findById(result.lastInsertRowid);
}

function update(id, { username, email, password, role }) {
  const user = findById(id);
  if (!user) return null;

  const newUsername = username ?? user.username;
  const newEmail = email ?? user.email;
  const newRole = role ?? user.role;
  const newPassword = password ? bcrypt.hashSync(password, SALT_ROUNDS) : user.password;

  db.prepare(
    'UPDATE users SET username = ?, email = ?, password = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(newUsername, newEmail, newPassword, newRole, id);

  return findById(id);
}

function deleteUser(id) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return { success: false, message: 'User not found' };

  if (user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get();
    if (adminCount.cnt <= 1) {
      return { success: false, message: 'Cannot delete the last admin user' };
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return { success: true };
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

function count() {
  return db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
}

module.exports = { findAll, findById, findByUsername, findByEmail, create, update, delete: deleteUser, verifyPassword, count };
