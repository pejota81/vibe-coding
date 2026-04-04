const express = require('express');
const router = express.Router();
const ConnectedAccountType = require('../models/connected_account_type');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireAdmin);

// List all account types
router.get('/', (req, res) => {
  const types = ConnectedAccountType.findAll();
  const csrfToken = res.locals.csrfToken || '';
  const rows = types.map(t => `
    <tr>
      <td>${t.sort_order}</td>
      <td>${escHtml(t.name)}</td>
      <td>${escHtml(t.placeholder)}</td>
      <td class="actions">
        <a href="/connected-accounts/${t.id}/edit" class="btn btn-secondary btn-sm">Edit</a>
        <form method="POST" action="/connected-accounts/${t.id}/delete" style="display:inline" data-name="${escHtml(t.name)}">
          <input type="hidden" name="_csrf" value="${escHtml(csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.renderTemplate('connected_accounts/index.html', {
    types_table: rows || '<tr><td colspan="4">No account types configured yet</td></tr>',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// New account type form
router.get('/new', (req, res) => {
  const types = ConnectedAccountType.findAll();
  const nextOrder = types.length ? (types[types.length - 1].sort_order + 10) : 10;
  res.renderTemplate('connected_accounts/new.html', {
    next_order: nextOrder,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Create account type
router.post('/', (req, res) => {
  const { name, placeholder, sort_order } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Name is required');
    return res.redirect('/connected-accounts/new');
  }
  try {
    ConnectedAccountType.create({ name: name.trim(), placeholder: placeholder || '', sort_order: parseInt(sort_order, 10) || 0 });
    req.flash('success', `Account type "${name.trim()}" created`);
    res.redirect('/connected-accounts');
  } catch (err) {
    req.flash('error', 'Error creating account type: ' + err.message);
    res.redirect('/connected-accounts/new');
  }
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const type = ConnectedAccountType.findById(req.params.id);
  if (!type) {
    req.flash('error', 'Account type not found');
    return res.redirect('/connected-accounts');
  }
  res.renderTemplate('connected_accounts/edit.html', {
    type_id: type.id,
    type_name: escHtml(type.name),
    type_placeholder: escHtml(type.placeholder),
    type_sort_order: type.sort_order,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Update account type
router.post('/:id', (req, res) => {
  const { name, placeholder, sort_order } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Name is required');
    return res.redirect(`/connected-accounts/${req.params.id}/edit`);
  }
  const type = ConnectedAccountType.update(req.params.id, {
    name: name.trim(),
    placeholder: placeholder || '',
    sort_order: parseInt(sort_order, 10) || 0
  });
  if (!type) {
    req.flash('error', 'Account type not found');
    return res.redirect('/connected-accounts');
  }
  req.flash('success', 'Account type updated successfully');
  res.redirect('/connected-accounts');
});

// Delete account type
router.post('/:id/delete', (req, res) => {
  const result = ConnectedAccountType.delete(req.params.id);
  if (result.success) {
    req.flash('success', 'Account type deleted successfully');
  } else {
    req.flash('error', result.message);
  }
  res.redirect('/connected-accounts');
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
