const express = require('express');
const router = express.Router();
const SocialPlatform = require('../models/social_platform');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireAdmin);

// List all platforms
router.get('/', (req, res) => {
  const platforms = SocialPlatform.findAll();
  const csrfToken = res.locals.csrfToken || '';
  const rows = platforms.map(p => `
    <tr>
      <td>${p.sort_order}</td>
      <td>${escHtml(p.name)}</td>
      <td>${escHtml(p.placeholder)}</td>
      <td class="actions">
        <a href="/social-platforms/${p.id}/edit" class="btn btn-secondary btn-sm">Edit</a>
        <form method="POST" action="/social-platforms/${p.id}/delete" style="display:inline" data-name="${escHtml(p.name)}">
          <input type="hidden" name="_csrf" value="${escHtml(csrfToken)}">
          <button type="submit" class="btn btn-danger btn-sm">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.renderTemplate('social_platforms/index.html', {
    platforms_table: rows || '<tr><td colspan="4">No platforms configured yet</td></tr>',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// New platform form
router.get('/new', (req, res) => {
  const platforms = SocialPlatform.findAll();
  const nextOrder = platforms.length ? (platforms[platforms.length - 1].sort_order + 10) : 10;
  res.renderTemplate('social_platforms/new.html', {
    next_order: nextOrder,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Create platform
router.post('/', (req, res) => {
  const { name, placeholder, sort_order } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Name is required');
    return res.redirect('/social-platforms/new');
  }
  try {
    SocialPlatform.create({ name: name.trim(), placeholder: placeholder || '', sort_order: parseInt(sort_order, 10) || 0 });
    req.flash('success', `Social platform "${name.trim()}" created`);
    res.redirect('/social-platforms');
  } catch (err) {
    req.flash('error', 'Error creating platform: ' + err.message);
    res.redirect('/social-platforms/new');
  }
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const platform = SocialPlatform.findById(req.params.id);
  if (!platform) {
    req.flash('error', 'Platform not found');
    return res.redirect('/social-platforms');
  }
  res.renderTemplate('social_platforms/edit.html', {
    platform_id: platform.id,
    platform_name: escHtml(platform.name),
    platform_placeholder: escHtml(platform.placeholder),
    platform_sort_order: platform.sort_order,
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

// Update platform
router.post('/:id', (req, res) => {
  const { name, placeholder, sort_order } = req.body;
  if (!name || !name.trim()) {
    req.flash('error', 'Name is required');
    return res.redirect(`/social-platforms/${req.params.id}/edit`);
  }
  const platform = SocialPlatform.update(req.params.id, {
    name: name.trim(),
    placeholder: placeholder || '',
    sort_order: parseInt(sort_order, 10) || 0
  });
  if (!platform) {
    req.flash('error', 'Platform not found');
    return res.redirect('/social-platforms');
  }
  req.flash('success', 'Platform updated successfully');
  res.redirect('/social-platforms');
});

// Delete platform
router.post('/:id/delete', (req, res) => {
  const result = SocialPlatform.delete(req.params.id);
  if (result.success) {
    req.flash('success', 'Platform deleted successfully');
  } else {
    req.flash('error', result.message);
  }
  res.redirect('/social-platforms');
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
