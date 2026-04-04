const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { requireAuth } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash('error', 'Too many login attempts. Please try again later.');
    res.redirect('/login');
  }
});

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.renderTemplate('login.html', {
    error: (req.flash('error') || []).join(' '),
    success: (req.flash('success') || []).join(' ')
  });
});

router.post('/login', loginLimiter, (req, res) => {
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
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/login');
  });
});

router.get('/auth/apple/connect', requireAuth, (req, res) => {
  const config = getAppleConfig();
  if (!config.isConfigured) {
    req.flash('error', 'Apple Sign In is not configured on this server yet.');
    return res.redirect('/dashboard');
  }

  const state = crypto.randomBytes(24).toString('hex');
  const nonce = crypto.randomBytes(24).toString('hex');

  req.session.appleOAuthState = state;
  req.session.appleOAuthNonce = nonce;

  const params = new URLSearchParams({
    response_type: 'code',
    response_mode: 'query',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'name email',
    state,
    nonce
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

router.get('/auth/apple/callback', requireAuth, async (req, res) => {
  const config = getAppleConfig();
  const { code, state, error } = req.query;

  if (!config.isConfigured) {
    req.flash('error', 'Apple Sign In is not configured on this server yet.');
    return res.redirect('/dashboard');
  }

  const expectedState = req.session.appleOAuthState;
  delete req.session.appleOAuthState;
  delete req.session.appleOAuthNonce;

  if (!state || !expectedState || state !== expectedState) {
    req.flash('error', 'Invalid Apple authorization state. Please try again.');
    return res.redirect('/dashboard');
  }

  if (error) {
    req.flash('error', `Apple authorization failed: ${error}`);
    return res.redirect('/dashboard');
  }

  if (!code) {
    req.flash('error', 'Apple did not return an authorization code.');
    return res.redirect('/dashboard');
  }

  try {
    const clientSecret = jwt.sign({}, config.privateKey, {
      algorithm: 'ES256',
      issuer: config.teamId,
      audience: 'https://appleid.apple.com',
      subject: config.clientId,
      expiresIn: '5m',
      header: { kid: config.keyId }
    });

    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: clientSecret
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error || 'Could not exchange code with Apple');
    }

    if (!tokenData.id_token) {
      throw new Error('Apple did not return an ID token');
    }

    const payload = decodeJwtPayload(tokenData.id_token);
    const appleSub = payload.sub;
    const appleEmail = payload.email;
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

    if (!appleSub) {
      throw new Error('Apple ID token is missing subject');
    }
    if (!audience.includes(config.clientId)) {
      throw new Error('Apple ID token audience mismatch');
    }
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new Error('Apple ID token issuer mismatch');
    }
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Apple ID token has expired');
    }

    const existingLinkedUser = User.findByAppleSub(appleSub);
    if (existingLinkedUser && existingLinkedUser.id !== req.session.userId) {
      req.flash('error', 'This Apple account is already linked to another user.');
      return res.redirect('/dashboard');
    }

    User.linkAppleAccount(req.session.userId, { appleSub, appleEmail });
    req.flash('success', 'Your account is now connected to Apple.');
  } catch (err) {
    req.flash('error', `Could not connect Apple account: ${err.message}`);
  }

  res.redirect('/dashboard');
});

function getAppleConfig() {
  const privateKey = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const redirectUri = process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/auth/apple/callback';

  return {
    privateKey,
    teamId,
    clientId,
    keyId,
    redirectUri,
    isConfigured: Boolean(privateKey && teamId && clientId && keyId)
  };
}

function decodeJwtPayload(token) {
  const parts = String(token).split('.');
  if (parts.length < 2) {
    throw new Error('Invalid ID token format');
  }

  const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(payloadJson);
}

module.exports = router;
