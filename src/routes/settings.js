const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Settings = require('../models/settings');

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.renderTemplate('settings.html', {
    apple_team_id: escHtml(Settings.get('apple_team_id') || process.env.APPLE_TEAM_ID || ''),
    apple_client_id: escHtml(Settings.get('apple_client_id') || process.env.APPLE_CLIENT_ID || ''),
    apple_key_id: escHtml(Settings.get('apple_key_id') || process.env.APPLE_KEY_ID || ''),
    apple_private_key: escHtml(Settings.get('apple_private_key') || ''),
    apple_redirect_uri: escHtml(
      Settings.get('apple_redirect_uri') ||
      process.env.APPLE_REDIRECT_URI ||
      'http://localhost:3000/auth/apple/callback'
    ),
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' '),
    username: req.session.username
  });
});

router.post('/apple', (req, res) => {
  const { apple_team_id, apple_client_id, apple_key_id, apple_private_key, apple_redirect_uri } = req.body;

  if (!apple_team_id || !apple_client_id || !apple_key_id || !apple_private_key) {
    req.flash('error', 'Team ID, Client ID, Key ID, and Private Key are all required.');
    return res.redirect('/settings');
  }

  Settings.set('apple_team_id', apple_team_id.trim());
  Settings.set('apple_client_id', apple_client_id.trim());
  Settings.set('apple_key_id', apple_key_id.trim());
  Settings.set('apple_private_key', apple_private_key.trim());
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
