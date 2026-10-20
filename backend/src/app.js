const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middleware/error-handler');
const { uploadDir, publicPrefix } = require('./config/uploads');

const SESSION_COOKIE = 'aura.sid';
const EIGHT_HOURS = 8 * 60 * 60 * 1000;
const frontendDir = path.join(__dirname, '..', '..', 'frontend', 'public');

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  console.warn('SESSION_SECRET is not set; using a random one (sessions reset on restart).');
  return crypto.randomBytes(32).toString('hex');
}

const app = express();

app.disable('x-powered-by');
app.set('sessionCookieName', SESSION_COOKIE);
// Stop browsers from guessing a different content type than the one we send.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(session({
  name: SESSION_COOKIE,
  secret: sessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: EIGHT_HOURS },
}));

app.use('/api', apiRoutes);
app.use(publicPrefix, express.static(uploadDir));
app.use(express.static(frontendDir));
app.use(errorHandler);

module.exports = app;
