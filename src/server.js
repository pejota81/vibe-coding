const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');
const csrfMiddleware = require('./middleware/csrf');
const { router: authRouter, getAppleConfig } = require('./routes/auth');

const crypto = require('crypto');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('ERROR: SESSION_SECRET environment variable must be set in production');
  process.exit(1);
}

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const app = express();

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method override for PUT/DELETE via forms
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Flash
app.use(flash());

// CSRF protection (must come after session and body parsing)
app.use(csrfMiddleware);

// Template renderer
function renderTemplate(res, templateName, data = {}) {
  const templatePath = path.join(__dirname, 'views', templateName);
  let html = fs.readFileSync(templatePath, 'utf8');

  // Replace {{key}} placeholders
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, value != null ? value : '');
  }

  // Handle {{#if key}}...{{/if}} conditionals (supports nesting by resolving innermost pairs first)
  // The regex matches {{#if X}}...{{/if}} blocks whose body does NOT contain another {{#if,
  // so nested structures are resolved from the inside out across iterations.
  let prev;
  let maxIter = 50;
  do {
    prev = html;
    html = html.replace(/\{\{#if (\w+)\}\}((?:(?!\{\{#if )[\s\S])*?)\{\{\/if\}\}/g, (_, key, content) => {
      return data[key] ? content : '';
    });
  } while (html !== prev && --maxIter > 0);

  // Clear any remaining placeholders
  html = html.replace(/\{\{[^}]+\}\}/g, '');

  res.send(html);
}

// Attach renderTemplate to res
app.use((req, res, next) => {
  res.renderTemplate = (templateName, data) => {
    const merged = Object.assign({
      csrf_token: res.locals.csrfToken || '',
      is_admin: req.session && req.session.role === 'admin' ? true : false,
      current_user_id: (req.session && req.session.userId) || ''
    }, data);
    return renderTemplate(res, templateName, merged);
  };
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const User = require('./models/user');
  const currentUser = User.findById(req.session.userId);

  res.renderTemplate('dashboard.html', {
    username: req.session.username,
    total_users: User.count(),
    apple_configured: getAppleConfig().isConfigured ? 'yes' : '',
    apple_connected: currentUser && currentUser.apple_sub ? 'yes' : '',
    apple_connected_at: currentUser && currentUser.apple_connected_at
      ? new Date(currentUser.apple_connected_at).toLocaleString()
      : '',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' ')
  });
});

app.use('/', authRouter);
app.use('/users', require('./routes/users'));
app.use('/roles', require('./routes/roles'));
app.use('/settings', require('./routes/settings'));

app.get('/profile', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const User = require('./models/user');
  const user = User.findById(req.session.userId);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/dashboard');
  }
  res.renderTemplate('profile.html', {
    user_username: user.username,
    user_email: user.email,
    user_role: user.role,
    user_first_name: user.first_name || '',
    user_last_name: user.last_name || '',
    user_birthday: user.birthday || '',
    user_website: user.website || '',
    user_social_facebook: user.social_facebook || '',
    user_social_instagram: user.social_instagram || '',
    user_social_twitter: user.social_twitter || '',
    user_social_linkedin: user.social_linkedin || '',
    user_social_youtube: user.social_youtube || '',
    user_social_tiktok: user.social_tiktok || '',
    user_social_snapchat: user.social_snapchat || '',
    user_social_pinterest: user.social_pinterest || '',
    user_social_reddit: user.social_reddit || '',
    user_social_discord: user.social_discord || '',
    user_microsoft_account: user.microsoft_account || '',
    user_apple_account: user.apple_account || '',
    user_google_account: user.google_account || '',
    member_since: new Date(user.created_at).toLocaleDateString(),
    username: req.session.username,
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' ')
  });
});

app.post('/profile', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  const User = require('./models/user');
  const { username, email, password,
    first_name, last_name, birthday, website,
    social_facebook, social_instagram, social_twitter, social_linkedin,
    social_youtube, social_tiktok, social_snapchat, social_pinterest,
    social_reddit, social_discord,
    microsoft_account, apple_account, google_account
  } = req.body;
  const id = req.session.userId;

  if (!username || !email) {
    req.flash('error', 'Username and email are required');
    return res.redirect('/profile');
  }

  const existing = User.findById(id);
  if (!existing) {
    req.flash('error', 'User not found');
    return res.redirect('/dashboard');
  }

  const byUsername = User.findByUsername(username);
  if (byUsername && byUsername.id !== id) {
    req.flash('error', 'Username already taken');
    return res.redirect('/profile');
  }

  const byEmail = User.findByEmail(email);
  if (byEmail && byEmail.id !== id) {
    req.flash('error', 'Email already taken');
    return res.redirect('/profile');
  }

  try {
    const updatedUser = User.update(id, { username, email, password: password || null,
      first_name, last_name, birthday: birthday || null, website,
      social_facebook, social_instagram, social_twitter, social_linkedin,
      social_youtube, social_tiktok, social_snapchat, social_pinterest,
      social_reddit, social_discord,
      microsoft_account, apple_account, google_account
    });
    if (updatedUser) {
      req.session.username = updatedUser.username;
    }
    req.flash('success', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (err) {
    req.flash('error', 'Error updating profile: ' + err.message);
    res.redirect('/profile');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('<h1>404 - Page Not Found</h1><a href="/">Go Home</a>');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('<h1>500 - Internal Server Error</h1>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
