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

const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    "INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@example.com', ?, 'admin')"
  ).run(hash);
  console.log('Default admin user created (username: admin, password: admin123)');
}

module.exports = db;
