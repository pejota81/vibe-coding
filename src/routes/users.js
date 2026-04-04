const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Role = require('../models/role');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

// Admin-only: list all users
router.get('/', requireAdmin, (req, res) => {
  const users = User.findAll();
  const csrfToken = res.locals.csrfToken || '';
  const rows = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${escHtml(u.username)}</td>
      <td>${escHtml(u.email)}</td>
      <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'user'}">${u.role}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td class="actions">
        <a href="/users/${u.id}/edit" class="btn btn-secondary btn-sm">Edit</a>
        <form method="POST" action="/users/${u.id}/delete" class="delete-form" style="display:inline" data-username="${escHtml(u.username)}">
          <input type="hidden" name="_csrf" value="${escHtml(csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.renderTemplate('users/index.html', {
    users_table: rows || '<tr><td colspan="6">No users found</td></tr>',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Admin-only: new user form
router.get('/new', requireAdmin, (req, res) => {
  const roles = Role.findAll();
  const roleOptions = roles.map(r =>
    `<option value="${escHtml(r.name)}">${escHtml(r.name)}</option>`
  ).join('');

  res.renderTemplate('users/new.html', {
    role_options: roleOptions,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Admin-only: create user
router.post('/', requireAdmin, (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    req.flash('error', 'Username, email, and password are required');
    return res.redirect('/users/new');
  }

  if (User.findByUsername(username)) {
    req.flash('error', 'Username already exists');
    return res.redirect('/users/new');
  }

  if (User.findByEmail(email)) {
    req.flash('error', 'Email already exists');
    return res.redirect('/users/new');
  }

  try {
    User.create({ username, email, password, role: role || 'user' });
    req.flash('success', `User "${username}" created successfully`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Error creating user: ' + err.message);
    res.redirect('/users/new');
  }
});

// Edit user: admin can edit any user; regular user can only edit their own profile
router.get('/:id/edit', (req, res) => {
  const isAdmin = req.session.role === 'admin';
  const isSelf = parseInt(req.params.id, 10) === req.session.userId;

  if (!isAdmin && !isSelf) {
    req.flash('error', 'You can only edit your own profile');
    return res.redirect('/dashboard');
  }

  const user = User.findById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect(isAdmin ? '/users' : '/dashboard');
  }

  const roles = Role.findAll();
  const roleOptions = roles.map(r =>
    `<option value="${escHtml(r.name)}" ${r.name === user.role ? 'selected' : ''}>${escHtml(r.name)}</option>`
  ).join('');

  res.renderTemplate('users/edit.html', {
    user_id: user.id,
    user_username: escHtml(user.username),
    user_email: escHtml(user.email),
    role_options: roleOptions,
    back_url: isAdmin ? '/users' : '/dashboard',
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Update user: admin can update any user; regular user can only update their own profile
router.post('/:id', (req, res) => {
  const isAdmin = req.session.role === 'admin';
  const numericId = parseInt(req.params.id, 10);
  const isSelf = numericId === req.session.userId;

  if (!isAdmin && !isSelf) {
    req.flash('error', 'You can only edit your own profile');
    return res.redirect('/dashboard');
  }

  const { username, email, password } = req.body;
  // Only admins can change roles
  const role = isAdmin ? req.body.role : undefined;
  const id = req.params.id;

  const existing = User.findById(id);
  if (!existing) {
    req.flash('error', 'User not found');
    return res.redirect(isAdmin ? '/users' : '/dashboard');
  }

  const byUsername = User.findByUsername(username);
  if (byUsername && byUsername.id !== numericId) {
    req.flash('error', 'Username already taken');
    return res.redirect(`/users/${id}/edit`);
  }

  const byEmail = User.findByEmail(email);
  if (byEmail && byEmail.id !== numericId) {
    req.flash('error', 'Email already taken');
    return res.redirect(`/users/${id}/edit`);
  }

  try {
    User.update(id, { username, email, password: password || null, role });
    req.flash('success', `Profile updated successfully`);
    return res.redirect(isAdmin ? '/users' : '/dashboard');
  } catch (err) {
    req.flash('error', 'Error updating user: ' + err.message);
    res.redirect(`/users/${id}/edit`);
  }
});

// Admin-only: delete user
router.post('/:id/delete', requireAdmin, (req, res) => {
  const result = User.delete(req.params.id);
  if (result.success) {
    req.flash('success', 'User deleted successfully');
  } else {
    req.flash('error', result.message);
  }
  res.redirect('/users');
});

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = router;
