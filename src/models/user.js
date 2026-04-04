const bcrypt = require('bcryptjs');
const db = require('../config/database');

const SALT_ROUNDS = 10;

function findAll() {
  return db.prepare('SELECT id, username, email, first_name, last_name, apple_sub, apple_connected_at, role, created_at, updated_at FROM users ORDER BY id').all();
}

function findById(id) {
  return db.prepare('SELECT id, username, email, first_name, last_name, birthday, website, social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube, social_tiktok, social_snapchat, social_pinterest, social_reddit, social_discord, microsoft_account, apple_account, google_account, apple_sub, apple_email, apple_connected_at, role, created_at, updated_at FROM users WHERE id = ?').get(id);
}

function findByIdWithPassword(id) {
  return db.prepare('SELECT id, username, email, password, first_name, last_name, birthday, website, social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube, social_tiktok, social_snapchat, social_pinterest, social_reddit, social_discord, microsoft_account, apple_account, google_account, apple_sub, apple_email, apple_connected_at, role, created_at, updated_at FROM users WHERE id = ?').get(id);
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findByAppleSub(appleSub) {
  return db.prepare('SELECT * FROM users WHERE apple_sub = ?').get(appleSub);
}

function create({ username, email, password, role = 'user' }) {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(username, email, hash, role);
  return findById(result.lastInsertRowid);
}

function update(id, { username, email, password, role, first_name, last_name, birthday, website, social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube, social_tiktok, social_snapchat, social_pinterest, social_reddit, social_discord, microsoft_account, apple_account, google_account }) {
  const user = db.prepare('SELECT id, username, email, password, first_name, last_name, birthday, website, social_facebook, social_instagram, social_twitter, social_linkedin, social_youtube, social_tiktok, social_snapchat, social_pinterest, social_reddit, social_discord, microsoft_account, apple_account, google_account, role, created_at, updated_at FROM users WHERE id = ?').get(id);
  if (!user) return null;

  const newUsername = username ?? user.username;
  const newEmail = email ?? user.email;
  const newRole = role ?? user.role;
  const newPassword = password ? bcrypt.hashSync(password, SALT_ROUNDS) : user.password;
  const newFirstName = first_name ?? user.first_name ?? '';
  const newLastName = last_name ?? user.last_name ?? '';
  const newBirthday = birthday !== undefined ? (birthday || null) : user.birthday;
  const newWebsite = website ?? user.website ?? '';
  const newSocialFacebook = social_facebook ?? user.social_facebook ?? '';
  const newSocialInstagram = social_instagram ?? user.social_instagram ?? '';
  const newSocialTwitter = social_twitter ?? user.social_twitter ?? '';
  const newSocialLinkedin = social_linkedin ?? user.social_linkedin ?? '';
  const newSocialYoutube = social_youtube ?? user.social_youtube ?? '';
  const newSocialTiktok = social_tiktok ?? user.social_tiktok ?? '';
  const newSocialSnapchat = social_snapchat ?? user.social_snapchat ?? '';
  const newSocialPinterest = social_pinterest ?? user.social_pinterest ?? '';
  const newSocialReddit = social_reddit ?? user.social_reddit ?? '';
  const newSocialDiscord = social_discord ?? user.social_discord ?? '';
  const newMicrosoftAccount = microsoft_account ?? user.microsoft_account ?? '';
  const newAppleAccount = apple_account ?? user.apple_account ?? '';
  const newGoogleAccount = google_account ?? user.google_account ?? '';

  if (newRole !== 'admin' && user.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get();
    if (adminCount.cnt <= 1) {
      throw new Error('Cannot remove admin role from the last admin user');
    }
  }

  db.prepare(
    `UPDATE users SET
      username = ?, email = ?, password = ?, role = ?,
      first_name = ?, last_name = ?, birthday = ?, website = ?,
      social_facebook = ?, social_instagram = ?, social_twitter = ?, social_linkedin = ?,
      social_youtube = ?, social_tiktok = ?, social_snapchat = ?, social_pinterest = ?,
      social_reddit = ?, social_discord = ?,
      microsoft_account = ?, apple_account = ?, google_account = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(
    newUsername, newEmail, newPassword, newRole,
    newFirstName, newLastName, newBirthday, newWebsite,
    newSocialFacebook, newSocialInstagram, newSocialTwitter, newSocialLinkedin,
    newSocialYoutube, newSocialTiktok, newSocialSnapchat, newSocialPinterest,
    newSocialReddit, newSocialDiscord,
    newMicrosoftAccount, newAppleAccount, newGoogleAccount,
    id
  );

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

function linkAppleAccount(userId, { appleSub, appleEmail }) {
  db.prepare(
    'UPDATE users SET apple_sub = ?, apple_email = COALESCE(?, apple_email), apple_connected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(appleSub, appleEmail || null, userId);

  return findById(userId);
}

module.exports = {
  findAll,
  findById,
  findByIdWithPassword,
  findByUsername,
  findByEmail,
  findByAppleSub,
  create,
  update,
  delete: deleteUser,
  verifyPassword,
  count,
  linkAppleAccount
};
