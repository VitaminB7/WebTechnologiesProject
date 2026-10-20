const HttpError = require('../utils/http-error');
const asyncHandler = require('../utils/async-handler');
const { findAdmin } = require('../services/admin.service');

/**
 * Reload the admin on every request so a deleted account (or a changed role)
 * takes effect immediately, not at next login.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const username = req.session && req.session.username;
  if (!username) throw new HttpError(401, 'Please log in');
  const admin = await findAdmin(username);
  if (!admin) {
    req.session.destroy(() => {});
    throw new HttpError(401, 'Please log in');
  }
  req.admin = admin;
  next();
});

/** Use after requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return next(new HttpError(403, 'You do not have permission for this action'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
