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
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    birthday DATE,
    website TEXT DEFAULT '',
    social_facebook TEXT DEFAULT '',
    social_instagram TEXT DEFAULT '',
    social_twitter TEXT DEFAULT '',
    social_linkedin TEXT DEFAULT '',
    social_youtube TEXT DEFAULT '',
    social_tiktok TEXT DEFAULT '',
    social_snapchat TEXT DEFAULT '',
    social_pinterest TEXT DEFAULT '',
    social_reddit TEXT DEFAULT '',
    social_discord TEXT DEFAULT '',
    microsoft_account TEXT DEFAULT '',
    apple_account TEXT DEFAULT '',
    google_account TEXT DEFAULT '',
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
if (!existingColumns.includes('first_name')) {
  db.exec("ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT ''");
}
if (!existingColumns.includes('last_name')) {
  db.exec("ALTER TABLE users ADD COLUMN last_name TEXT DEFAULT ''");
}
if (!existingColumns.includes('birthday')) {
  db.exec('ALTER TABLE users ADD COLUMN birthday DATE');
}
if (!existingColumns.includes('website')) {
  db.exec("ALTER TABLE users ADD COLUMN website TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_facebook')) {
  db.exec("ALTER TABLE users ADD COLUMN social_facebook TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_instagram')) {
  db.exec("ALTER TABLE users ADD COLUMN social_instagram TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_twitter')) {
  db.exec("ALTER TABLE users ADD COLUMN social_twitter TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_linkedin')) {
  db.exec("ALTER TABLE users ADD COLUMN social_linkedin TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_youtube')) {
  db.exec("ALTER TABLE users ADD COLUMN social_youtube TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_tiktok')) {
  db.exec("ALTER TABLE users ADD COLUMN social_tiktok TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_snapchat')) {
  db.exec("ALTER TABLE users ADD COLUMN social_snapchat TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_pinterest')) {
  db.exec("ALTER TABLE users ADD COLUMN social_pinterest TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_reddit')) {
  db.exec("ALTER TABLE users ADD COLUMN social_reddit TEXT DEFAULT ''");
}
if (!existingColumns.includes('social_discord')) {
  db.exec("ALTER TABLE users ADD COLUMN social_discord TEXT DEFAULT ''");
}
if (!existingColumns.includes('microsoft_account')) {
  db.exec("ALTER TABLE users ADD COLUMN microsoft_account TEXT DEFAULT ''");
}
if (!existingColumns.includes('apple_account')) {
  db.exec("ALTER TABLE users ADD COLUMN apple_account TEXT DEFAULT ''");
}
if (!existingColumns.includes('google_account')) {
  db.exec("ALTER TABLE users ADD COLUMN google_account TEXT DEFAULT ''");
}

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub) WHERE apple_sub IS NOT NULL');

db.exec(`
  CREATE TABLE IF NOT EXISTS social_platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    placeholder TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_social_links (
    user_id INTEGER NOT NULL,
    platform_id INTEGER NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, platform_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES social_platforms(id) ON DELETE CASCADE
  )
`);

// Seed the 10 default social platforms and migrate any existing user data
const defaultPlatforms = [
  { name: 'Facebook',    placeholder: 'https://facebook.com/yourprofile',      col: 'social_facebook',  order: 10 },
  { name: 'Instagram',   placeholder: 'https://instagram.com/yourhandle',      col: 'social_instagram', order: 20 },
  { name: 'X / Twitter', placeholder: 'https://x.com/yourhandle',              col: 'social_twitter',   order: 30 },
  { name: 'LinkedIn',    placeholder: 'https://linkedin.com/in/yourprofile',   col: 'social_linkedin',  order: 40 },
  { name: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel',      col: 'social_youtube',   order: 50 },
  { name: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle',        col: 'social_tiktok',    order: 60 },
  { name: 'Snapchat',    placeholder: 'your-snapchat-username',                col: 'social_snapchat',  order: 70 },
  { name: 'Pinterest',   placeholder: 'https://pinterest.com/yourprofile',     col: 'social_pinterest', order: 80 },
  { name: 'Reddit',      placeholder: 'https://reddit.com/u/yourhandle',       col: 'social_reddit',    order: 90 },
  { name: 'Discord',     placeholder: 'yourhandle',                            col: 'social_discord',   order: 100 },
];

for (const p of defaultPlatforms) {
  const exists = db.prepare('SELECT id FROM social_platforms WHERE name = ?').get(p.name);
  if (!exists) {
    db.prepare('INSERT INTO social_platforms (name, placeholder, sort_order) VALUES (?, ?, ?)').run(p.name, p.placeholder, p.order);
  }
}

// One-time migration: copy data from old social_* columns into user_social_links
if (existingColumns.includes('social_facebook')) {
  const upsertLink = db.prepare(
    'INSERT OR IGNORE INTO user_social_links (user_id, platform_id, value) VALUES (?, ?, ?)'
  );
  for (const p of defaultPlatforms) {
    if (!existingColumns.includes(p.col)) continue;
    const platform = db.prepare('SELECT id FROM social_platforms WHERE name = ?').get(p.name);
    if (!platform) continue;
    const usersWithValue = db.prepare(
      `SELECT id, ${p.col} AS val FROM users WHERE ${p.col} IS NOT NULL AND ${p.col} != ''`
    ).all();
    for (const u of usersWithValue) {
      if (u.val) upsertLink.run(u.id, platform.id, u.val);
    }
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS connected_account_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    placeholder TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_connected_accounts (
    user_id INTEGER NOT NULL,
    account_type_id INTEGER NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, account_type_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_type_id) REFERENCES connected_account_types(id) ON DELETE CASCADE
  )
`);

// Seed the 3 default connected account types and migrate any existing user data
const defaultAccountTypes = [
  { name: 'Microsoft Account (Outlook / Live / Hotmail)', placeholder: 'you@outlook.com', col: 'microsoft_account', order: 10 },
  { name: 'Apple Account',                                placeholder: 'you@icloud.com',  col: 'apple_account',     order: 20 },
  { name: 'Google Account',                               placeholder: 'you@gmail.com',   col: 'google_account',    order: 30 },
];

for (const t of defaultAccountTypes) {
  const exists = db.prepare('SELECT id FROM connected_account_types WHERE name = ?').get(t.name);
  if (!exists) {
    db.prepare('INSERT INTO connected_account_types (name, placeholder, sort_order) VALUES (?, ?, ?)').run(t.name, t.placeholder, t.order);
  }
}

// One-time migration: copy data from old *_account columns into user_connected_accounts
if (existingColumns.includes('microsoft_account')) {
  const upsertAccount = db.prepare(
    'INSERT OR IGNORE INTO user_connected_accounts (user_id, account_type_id, value) VALUES (?, ?, ?)'
  );
  for (const t of defaultAccountTypes) {
    if (!existingColumns.includes(t.col)) continue;
    const accountType = db.prepare('SELECT id FROM connected_account_types WHERE name = ?').get(t.name);
    if (!accountType) continue;
    const usersWithValue = db.prepare(
      `SELECT id, ${t.col} AS val FROM users WHERE ${t.col} IS NOT NULL AND ${t.col} != ''`
    ).all();
    for (const u of usersWithValue) {
      if (u.val) upsertAccount.run(u.id, accountType.id, u.val);
    }
  }
}

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
