const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const fs = require('fs');

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
  secret: process.env.SESSION_SECRET || 'vibe-coding-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Flash
app.use(flash());

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
  res.renderTemplate = (templateName, data) => renderTemplate(res, templateName, data);
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
  res.renderTemplate('dashboard.html', {
    username: req.session.username,
    total_users: User.count()
  });
});

app.use('/', require('./routes/auth'));
app.use('/users', require('./routes/users'));

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
