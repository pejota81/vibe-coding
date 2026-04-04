const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');
const csrfMiddleware = require('./middleware/csrf');

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

  // Handle {{#if key}}...{{/if}} conditionals
  html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return data[key] ? content : '';
  });

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
    apple_connected: currentUser && currentUser.apple_sub ? 'yes' : '',
    apple_connected_at: currentUser && currentUser.apple_connected_at
      ? new Date(currentUser.apple_connected_at).toLocaleString()
      : '',
    success: (req.flash('success') || []).join(' '),
    error: (req.flash('error') || []).join(' ')
  });
});

app.use('/', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/roles', require('./routes/roles'));

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
