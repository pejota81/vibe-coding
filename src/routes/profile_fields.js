const express = require('express');
const router = express.Router();
const ProfileFieldType = require('../models/profile_field_type');
const { requireAuth, requirePermission } = require('../middleware/auth');

const INPUT_TYPES = ['text', 'email', 'date', 'url', 'number', 'tel'];

router.use(requireAuth);
router.use(requirePermission('manage_profile_fields'));

// List all field types
router.get('/', (req, res) => {
  const fields = ProfileFieldType.findAll();
  const csrfToken = res.locals.csrfToken || '';
  const rows = fields.map(f => `
    <tr>
      <td>${f.sort_order}</td>
      <td>${escHtml(f.name)}</td>
      <td><code>${escHtml(f.input_type)}</code></td>
      <td>${escHtml(f.placeholder)}</td>
      <td>${f.is_mandatory ? '<span class="badge badge-admin">Yes</span>' : '<span class="badge badge-user">No</span>'}</td>
      <td class="actions">
        <a href="/profile-fields/${f.id}/edit" class="btn btn-secondary btn-sm">Edit</a>
        <form method="POST" action="/profile-fields/${f.id}/delete" style="display:inline" data-name="${escHtml(f.name)}">
          <input type="hidden" name="_csrf" value="${escHtml(csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.renderTemplate('profile_fields/index.html', {
    fields_table: rows || '<tr><td colspan="6">No fields configured yet</td></tr>',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// New field form
router.get('/new', (req, res) => {
  const fields = ProfileFieldType.findAll();
  const nextOrder = fields.length ? (fields[fields.length - 1].sort_order + 10) : 10;
  res.renderTemplate('profile_fields/new.html', {
    next_order: nextOrder,
    input_type_options: buildInputTypeOptions('text'),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Create field
router.post('/', (req, res) => {
  const { name, input_type, placeholder, is_mandatory, sort_order } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Name is required');
    return res.redirect('/profile-fields/new');
  }
  if (!INPUT_TYPES.includes(input_type)) {
    req.flash('error', 'Invalid input type');
    return res.redirect('/profile-fields/new');
  }
  try {
    ProfileFieldType.create({
      name: name.trim(),
      input_type,
      placeholder: placeholder || '',
      is_mandatory: is_mandatory === 'on' ? 1 : 0,
      sort_order: parseInt(sort_order, 10) || 0
    });
    req.flash('success', `Field "${name.trim()}" created`);
    res.redirect('/profile-fields');
  } catch (err) {
    req.flash('error', 'Error creating field: ' + err.message);
    res.redirect('/profile-fields/new');
  }
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const field = ProfileFieldType.findById(req.params.id);
  if (!field) {
    req.flash('error', 'Field not found');
    return res.redirect('/profile-fields');
  }
  res.renderTemplate('profile_fields/edit.html', {
    field_id: field.id,
    field_name: escHtml(field.name),
    field_placeholder: escHtml(field.placeholder),
    field_sort_order: field.sort_order,
    field_is_mandatory: field.is_mandatory ? 'checked' : '',
    input_type_options: buildInputTypeOptions(field.input_type),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Update field
router.post('/:id', (req, res) => {
  const { name, input_type, placeholder, is_mandatory, sort_order } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Name is required');
    return res.redirect(`/profile-fields/${req.params.id}/edit`);
  }
  if (!INPUT_TYPES.includes(input_type)) {
    req.flash('error', 'Invalid input type');
    return res.redirect(`/profile-fields/${req.params.id}/edit`);
  }
  const field = ProfileFieldType.update(req.params.id, {
    name: name.trim(),
    input_type,
    placeholder: placeholder || '',
    is_mandatory: is_mandatory === 'on' ? 1 : 0,
    sort_order: parseInt(sort_order, 10) || 0
  });
  if (!field) {
    req.flash('error', 'Field not found');
    return res.redirect('/profile-fields');
  }
  req.flash('success', 'Field updated successfully');
  res.redirect('/profile-fields');
});

// Delete field
router.post('/:id/delete', (req, res) => {
  const result = ProfileFieldType.delete(req.params.id);
  if (result.success) {
    req.flash('success', 'Field deleted successfully');
  } else {
    req.flash('error', result.message);
  }
  res.redirect('/profile-fields');
});

function buildInputTypeOptions(selected) {
  return INPUT_TYPES.map(t =>
    `<option value="${t}"${t === selected ? ' selected' : ''}>${t}</option>`
  ).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = router;
