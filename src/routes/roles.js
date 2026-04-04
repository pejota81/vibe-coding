const express = require('express');
const router = express.Router();
const Role = require('../models/role');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// List all roles
router.get('/', (req, res) => {
  const roles = Role.findAll();
  const csrfToken = res.locals.csrfToken || '';

  const rows = roles.map(r => {
    const perms = Role.getPermissions(r.id).map(p => escHtml(p.name)).join(', ') || '<em>none</em>';
    const deleteBtn = r.protected
      ? `<button class="btn btn-danger btn-sm" disabled title="Built-in role cannot be deleted">Delete</button>`
      : `<form method="POST" action="/roles/${r.id}/delete" class="delete-role-form" style="display:inline" data-rolename="${escHtml(r.name)}">
           <input type="hidden" name="_csrf" value="${escHtml(csrfToken)}">
           <button type="submit" class="btn btn-danger btn-sm">Delete</button>
         </form>`;
    return `
      <tr>
        <td>${r.id}</td>
        <td>${escHtml(r.name)}${r.protected ? ' <span class="badge badge-admin">built-in</span>' : ''}</td>
        <td>${escHtml(r.description)}</td>
        <td>${perms}</td>
        <td class="actions">
          <a href="/roles/${r.id}/edit" class="btn btn-secondary btn-sm">Edit</a>
          ${deleteBtn}
        </td>
      </tr>`;
  }).join('');

  res.renderTemplate('roles/index.html', {
    roles_table: rows || '<tr><td colspan="5">No roles found</td></tr>',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// New role form
router.get('/new', (req, res) => {
  const permissions = Role.findAllPermissions();
  const permsHtml = permissions.map(p => `
    <div class="form-check">
      <input type="checkbox" id="perm_${p.id}" name="permissions" value="${p.id}" class="form-check-input">
      <label for="perm_${p.id}" class="form-check-label">
        <strong>${escHtml(p.name)}</strong> — ${escHtml(p.description)}
      </label>
    </div>`).join('');

  res.renderTemplate('roles/new.html', {
    permissions_html: permsHtml,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Create role
router.post('/', (req, res) => {
  const { name, description } = req.body;
  const permissionIds = [].concat(req.body.permissions || []).map(Number);

  if (!name || !name.trim()) {
    req.flash('error', 'Role name is required');
    return res.redirect('/roles/new');
  }

  if (Role.findByName(name.trim())) {
    req.flash('error', `A role named "${name.trim()}" already exists`);
    return res.redirect('/roles/new');
  }

  try {
    const role = Role.create({ name: name.trim(), description: description || '' });
    Role.setPermissions(role.id, permissionIds);
    req.flash('success', `Role "${role.name}" created successfully`);
    res.redirect('/roles');
  } catch (err) {
    req.flash('error', 'Error creating role: ' + err.message);
    res.redirect('/roles/new');
  }
});

// Edit role form
router.get('/:id/edit', (req, res) => {
  const role = Role.findById(req.params.id);
  if (!role) {
    req.flash('error', 'Role not found');
    return res.redirect('/roles');
  }

  const assigned = new Set(Role.getPermissions(role.id).map(p => p.id));
  const permissions = Role.findAllPermissions();
  const permsHtml = permissions.map(p => `
    <div class="form-check">
      <input type="checkbox" id="perm_${p.id}" name="permissions" value="${p.id}"
             class="form-check-input" ${assigned.has(p.id) ? 'checked' : ''}>
      <label for="perm_${p.id}" class="form-check-label">
        <strong>${escHtml(p.name)}</strong> — ${escHtml(p.description)}
      </label>
    </div>`).join('');

  res.renderTemplate('roles/edit.html', {
    role_id: role.id,
    role_name: escHtml(role.name),
    role_description: escHtml(role.description),
    role_protected: role.protected ? 'true' : '',
    permissions_html: permsHtml,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Update role
router.post('/:id', (req, res) => {
  const role = Role.findById(req.params.id);
  if (!role) {
    req.flash('error', 'Role not found');
    return res.redirect('/roles');
  }

  const { name, description } = req.body;
  const permissionIds = [].concat(req.body.permissions || []).map(Number);

  if (!name || !name.trim()) {
    req.flash('error', 'Role name is required');
    return res.redirect(`/roles/${role.id}/edit`);
  }

  const existing = Role.findByName(name.trim());
  if (existing && existing.id !== role.id) {
    req.flash('error', `A role named "${name.trim()}" already exists`);
    return res.redirect(`/roles/${role.id}/edit`);
  }

  try {
    // Protected roles keep their name to preserve referential integrity with users.role
    const updatedName = role.protected ? role.name : name.trim();
    Role.update(role.id, { name: updatedName, description: description || '' });
    Role.setPermissions(role.id, permissionIds);
    req.flash('success', `Role "${updatedName}" updated successfully`);
    res.redirect('/roles');
  } catch (err) {
    req.flash('error', 'Error updating role: ' + err.message);
    res.redirect(`/roles/${role.id}/edit`);
  }
});

// Delete role
router.post('/:id/delete', (req, res) => {
  const result = Role.delete(req.params.id);
  if (result.success) {
    req.flash('success', 'Role deleted successfully');
  } else {
    req.flash('error', result.message);
  }
  res.redirect('/roles');
});

module.exports = router;
