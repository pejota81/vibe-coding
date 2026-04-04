function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.flash('error', 'Please log in to access this page');
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admin privileges required.');
  res.redirect('/dashboard');
}

function requirePermission(permName) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      req.flash('error', 'Please log in to access this page');
      return res.redirect('/login');
    }
    const db = require('../config/database');
    const perm = db.prepare(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      JOIN roles r ON r.id = rp.role_id
      WHERE r.name = ? AND p.name = ?
    `).get(req.session.role, permName);
    if (perm) return next();
    req.flash('error', 'Access denied. You do not have permission to access this page.');
    return res.redirect('/dashboard');
  };
}

module.exports = { requireAuth, requireAdmin, requirePermission };
