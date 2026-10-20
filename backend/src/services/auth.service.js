const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const { logAction } = require('../utils/log-action');
const { findAdmin } = require('./admin.service');

// Compared against when the user does not exist, so response time does not reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/** Look up by username first, then by any of the admin's emails. */
async function findCredentials(identifier) {
  const [rows] = await pool.execute(
    `SELECT Username, Password, Status FROM AdminAccount
     WHERE Username = ? OR Username IN (SELECT Username FROM AdminEmail WHERE Email = ?)
     ORDER BY Username = ? DESC
     LIMIT 1`,
    [identifier, identifier, identifier],
  );
  return rows[0] || null;
}

/** Returns the Admin object on success; throws 401 (bad credentials) or 403 (inactive). */
async function login(identifier, password) {
  const account = await findCredentials(identifier);
  const passwordOk = await bcrypt.compare(password, account ? account.Password : DUMMY_HASH);
  if (!account || !passwordOk) {
    throw new HttpError(401, 'Invalid username or password');
  }
  if (account.Status !== 'active') {
    throw new HttpError(403, 'This account is inactive');
  }
  await logAction(pool, account.Username, `LOGIN ${account.Username}`);
  return findAdmin(account.Username);
}

module.exports = { login };
