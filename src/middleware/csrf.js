const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfMiddleware(req, res, next) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const token = req.body._csrf || req.headers['x-csrf-token'];
    const sessionToken = req.session.csrfToken;
    
    // Debug logging (can be removed after fixing the issue)
    if (process.env.DEBUG_CSRF) {
      console.log('[CSRF Debug]', {
        method: req.method,
        path: req.path,
        hasToken: !!token,
        hasSessionToken: !!sessionToken,
        tokenMatch: token === sessionToken,
        sessionId: req.sessionID
      });
    }
    
    if (!token || token !== sessionToken) {
      console.error('[CSRF Error]', {
        path: req.path,
        method: req.method,
        tokenProvided: !!token,
        tokenInSession: !!sessionToken,
        mismatch: token !== sessionToken
      });
      return res.status(403).send('<h1>403 - Invalid CSRF Token</h1><p>Session may have expired. <a href="/login">Return to login and try again</a></p>');
    }
  }

  res.locals.csrfToken = req.session.csrfToken;
  next();
}

module.exports = csrfMiddleware;
