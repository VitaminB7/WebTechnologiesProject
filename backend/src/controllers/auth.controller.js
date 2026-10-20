const authService = require('../services/auth.service');
const assertValid = require('../utils/assert-valid');
const { validateLogin } = require('../validators/auth.validator');

// express-session uses callbacks; wrap them so controllers can await.
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

async function login(req, res) {
  const { username, password } = assertValid(validateLogin(req.body));
  const admin = await authService.login(username, password);
  // New session id on login prevents session fixation.
  await regenerateSession(req);
  req.session.username = admin.username;
  res.json({ data: admin });
}

async function logout(req, res) {
  await destroySession(req);
  res.clearCookie(req.app.get('sessionCookieName'));
  res.json({ data: { ok: true } });
}

function me(req, res) {
  res.json({ data: req.admin });
}

module.exports = { login, logout, me };
