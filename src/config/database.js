const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    apple_sub TEXT UNIQUE,
    apple_email TEXT,
    apple_connected_at DATETIME,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const existingColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!existingColumns.includes('apple_sub')) {
  db.exec('ALTER TABLE users ADD COLUMN apple_sub TEXT');
}
if (!existingColumns.includes('apple_email')) {
  db.exec('ALTER TABLE users ADD COLUMN apple_email TEXT');
}
if (!existingColumns.includes('apple_connected_at')) {
  db.exec('ALTER TABLE users ADD COLUMN apple_connected_at DATETIME');
}

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub) WHERE apple_sub IS NOT NULL');

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    protected INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT ''
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )
`);

// Seed built-in roles (protected — cannot be deleted)
const adminRoleExists = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
if (!adminRoleExists) {
  db.prepare("INSERT INTO roles (name, description, protected) VALUES ('admin', 'Full access to all features', 1)").run();
}
const userRoleExists = db.prepare("SELECT id FROM roles WHERE name = 'user'").get();
if (!userRoleExists) {
  db.prepare("INSERT INTO roles (name, description, protected) VALUES ('user', 'Standard user with limited access', 1)").run();
}

// Seed built-in permissions
const seedPermissions = [
  { name: 'manage_users', description: 'Create, edit and delete users' },
  { name: 'manage_roles', description: 'Create, edit and delete roles' }
];
for (const perm of seedPermissions) {
  const exists = db.prepare('SELECT id FROM permissions WHERE name = ?').get(perm.name);
  if (!exists) {
    db.prepare('INSERT INTO permissions (name, description) VALUES (?, ?)').run(perm.name, perm.description);
  }
}

// Assign all permissions to the admin role
const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
if (adminRole) {
  const allPerms = db.prepare('SELECT id FROM permissions').all();
  for (const perm of allPerms) {
    const alreadyAssigned = db.prepare(
      'SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ?'
    ).get(adminRole.id, perm.id);
    if (!alreadyAssigned) {
      db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(adminRole.id, perm.id);
    }
  }
}

const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    "INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@example.com', ?, 'admin')"
  ).run(hash);
  console.log('Default admin user created (username: admin, password: admin123)');
}

module.exports = db;
