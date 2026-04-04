const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Role = require('../models/role');
const SocialPlatform = require('../models/social_platform');
const ConnectedAccountType = require('../models/connected_account_type');
const ProfileFieldType = require('../models/profile_field_type');
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


  const sections = Role.getSectionVisibility(user.role);

  let personalInfoFields = '';
  if (sections.show_personal_info) {
    const profileFieldTypes = ProfileFieldType.findAll();
    const profileFieldRows = ProfileFieldType.getUserProfileFields(user.id);
    const profileFieldMap = {};
    for (const row of profileFieldRows) profileFieldMap[row.field_type_id] = row.value;
    personalInfoFields = profileFieldTypes.map(f => {
      const required = f.is_mandatory ? ' required' : '';
      const reqLabel = f.is_mandatory ? ' <span style="color:#e94560">*</span>' : '';
      return `
    <div class="form-group">
      <label for="profile_field_${f.id}">${escHtml(f.name)}${reqLabel}</label>
      <input type="${escHtml(f.input_type)}" id="profile_field_${f.id}" name="profile_field_${f.id}" class="form-control"
             value="${escHtml(profileFieldMap[f.id] || '')}" placeholder="${escHtml(f.placeholder)}"${required}>
    </div>`;
    }).join('');
  }

  let socialFields = '';
  if (sections.show_social_media) {
    const platforms = SocialPlatform.findAll();
    const linkRows = SocialPlatform.getUserSocialLinks(user.id);
    const linkMap = {};
    for (const row of linkRows) linkMap[row.platform_id] = row.value;
    socialFields = platforms.map(p => `
    <div class="form-group">
      <label for="social_link_${p.id}">${escHtml(p.name)}</label>
      <input type="text" id="social_link_${p.id}" name="social_link_${p.id}" class="form-control"
             value="${escHtml(linkMap[p.id] || '')}" placeholder="${escHtml(p.placeholder)}">
    </div>`).join('');
  }

  let connectedAccountFields = '';
  if (sections.show_connected_accounts) {
    const accountTypes = ConnectedAccountType.findAll();
    const accountRows = ConnectedAccountType.getUserConnectedAccounts(user.id);
    const accountMap = {};
    for (const row of accountRows) accountMap[row.account_type_id] = row.value;
    connectedAccountFields = accountTypes.map(t => `
    <div class="form-group">
      <label for="connected_account_${t.id}">${escHtml(t.name)}</label>
      <input type="text" id="connected_account_${t.id}" name="connected_account_${t.id}" class="form-control"
             value="${escHtml(accountMap[t.id] || '')}" placeholder="${escHtml(t.placeholder)}">
    </div>`).join('');
  }

  res.renderTemplate('users/edit.html', {
    user_id: user.id,
    user_username: escHtml(user.username),
    user_email: escHtml(user.email),
    personal_info_fields: personalInfoFields,
    social_links_fields: socialFields,
    connected_accounts_fields: connectedAccountFields,
    show_personal_info: sections.show_personal_info,
    show_social_media: sections.show_social_media,
    show_connected_accounts: sections.show_connected_accounts,
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

  const targetRoleName = role || existing.role;
  const sections = Role.getSectionVisibility(targetRoleName);

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
    const updatedUser = User.update(id, { username, email, password: password || null, role });
    if (isSelf && updatedUser) {
      req.session.username = updatedUser.username;
      req.session.role = updatedUser.role;
    }

    if (sections.show_personal_info) {
      const allProfileFieldTypes = ProfileFieldType.findAll();
      const profileFields = allProfileFieldTypes.map(f => ({ field_type_id: f.id, value: req.body[`profile_field_${f.id}`] || '' }));
      ProfileFieldType.upsertUserProfileFields(numericId, profileFields);
    }

    if (sections.show_social_media) {
      const platforms = SocialPlatform.findAll();
      const links = platforms.map(p => ({ platform_id: p.id, value: req.body[`social_link_${p.id}`] || '' }));
      SocialPlatform.upsertUserSocialLinks(numericId, links);
    }

    if (sections.show_connected_accounts) {
      const accountTypes = ConnectedAccountType.findAll();
      const accounts = accountTypes.map(t => ({ account_type_id: t.id, value: req.body[`connected_account_${t.id}`] || '' }));
      ConnectedAccountType.upsertUserConnectedAccounts(numericId, accounts);
    }

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
