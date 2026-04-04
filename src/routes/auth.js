const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Simple in-memory rate limiter for login: max 10 attempts per IP per 15 minutes
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  entry.count += 1;
  loginAttempts.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    req.flash('error', 'Too many login attempts. Please try again later.');
    return res.redirect('/login');
  }
  next();
}

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.renderTemplate('login.html', {
    error: (req.flash('error') || []).join(' '),
    success: (req.flash('success') || []).join(' ')
  });
});

router.post('/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.flash('error', 'Username and password are required');
    return res.redirect('/login');
  }

  const user = User.findByUsername(username);
  if (!user || !User.verifyPassword(password, user.password)) {
    req.flash('error', 'Invalid username or password');
    return res.redirect('/login');
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
