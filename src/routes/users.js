const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
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

router.get('/new', (req, res) => {
  res.renderTemplate('users/new.html', {
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

router.post('/', (req, res) => {
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

router.get('/:id/edit', (req, res) => {
  const user = User.findById(req.params.id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/users');
  }
  res.renderTemplate('users/edit.html', {
    user_id: user.id,
    user_username: escHtml(user.username),
    user_email: escHtml(user.email),
    user_role_admin: user.role === 'admin' ? 'selected' : '',
    user_role_user: user.role === 'user' ? 'selected' : '',
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

router.post('/:id', (req, res) => {
  const { username, email, password, role } = req.body;
  const id = req.params.id;

  const existing = User.findById(id);
  if (!existing) {
    req.flash('error', 'User not found');
    return res.redirect('/users');
  }

  const numericId = parseInt(id, 10);
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
    req.flash('success', `User "${username}" updated successfully`);
    res.redirect('/users');
  } catch (err) {
    req.flash('error', 'Error updating user: ' + err.message);
    res.redirect(`/users/${id}/edit`);
  }
});

router.post('/:id/delete', (req, res) => {
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
