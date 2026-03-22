function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.flash = { type: 'danger', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.flash = { type: 'danger', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  if (!req.session.isAdmin) {
    req.session.flash = { type: 'danger', message: 'Admin access required.' };
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
