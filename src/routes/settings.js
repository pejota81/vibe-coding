const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Settings = require('../models/settings');

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', (req, res) => {
  const privateKeyConfigured = Boolean(Settings.get('apple_private_key'));
  res.renderTemplate('settings.html', {
    apple_team_id: escHtml(Settings.get('apple_team_id') || ''),
    apple_client_id: escHtml(Settings.get('apple_client_id') || ''),
    apple_key_id: escHtml(Settings.get('apple_key_id') || ''),
    apple_private_key_configured: privateKeyConfigured ? 'yes' : '',
    apple_redirect_uri: escHtml(Settings.get('apple_redirect_uri') || ''),
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

router.post('/apple', (req, res) => {
  const { apple_team_id, apple_client_id, apple_key_id, apple_private_key, apple_redirect_uri } = req.body;

  const existingKey = Settings.get('apple_private_key');
  const newKey = apple_private_key ? apple_private_key.trim() : '';

  if (!apple_team_id || !apple_client_id || !apple_key_id) {
    req.flash('error', 'Team ID, Client ID, and Key ID are required.');
    return res.redirect('/settings');
  }
  if (!newKey && !existingKey) {
    req.flash('error', 'A Private Key is required to enable Apple Sign In.');
    return res.redirect('/settings');
  }

  Settings.set('apple_team_id', apple_team_id.trim());
  Settings.set('apple_client_id', apple_client_id.trim());
  Settings.set('apple_key_id', apple_key_id.trim());
  if (newKey) {
    Settings.set('apple_private_key', newKey);
  }
  if (apple_redirect_uri && apple_redirect_uri.trim()) {
    Settings.set('apple_redirect_uri', apple_redirect_uri.trim());
  }

  req.flash('success', 'Apple Sign In settings saved. Users can now connect their Apple accounts.');
  res.redirect('/settings');
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
