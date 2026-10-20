const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const withTransaction = require('../utils/transaction');
const { toAdmin } = require('../utils/mappers');
const { logAction, describeChanges } = require('../utils/log-action');
const { isDuplicateKey, escapeLike } = require('../utils/sql-helpers');

const BCRYPT_COST = 10;
// Password is deliberately not in this list: it must never leave the service.
const ADMIN_COLUMNS = 'Username, Fname, Lname, Address, Role, Email';

function notFound(username) {
  return new HttpError(404, `Admin ${username} not found`);
}

function sameUser(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

/** Turn ER_DUP_ENTRY into a 409 that names the field: UNIQUE(Email) or the Username key. */
function duplicateError(err, input) {
  if (/uq_admin_email/.test(err.message)) {
    return new HttpError(409, 'Email already used by another admin', { email: 'already used by another admin' });
  }
  return new HttpError(409, `Username ${input.username} already exists`, { username: 'already exists' });
}

async function findAdminRow(db, username, { lock = false } = {}) {
  const [rows] = await db.execute(
    `SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ?${lock ? ' FOR UPDATE' : ''}`,
    [username],
  );
  return rows[0] || null;
}

/** Admin object or null; used by the auth middleware on every request. */
async function findAdmin(username) {
  const row = await findAdminRow(pool, username);
  return row ? toAdmin(row) : null;
}

async function getAdmin(username) {
  const admin = await findAdmin(username);
  if (!admin) throw notFound(username);
  return admin;
}

async function listAdmins(filters) {
  const clauses = [];
  const params = [];
  if (filters.q !== null) {
    const like = `%${escapeLike(filters.q)}%`;
    clauses.push("(Username LIKE ? OR CONCAT(Fname, ' ', Lname) LIKE ? OR Email LIKE ?)");
    params.push(like, like, like);
  }
  if (filters.role !== null) { clauses.push('Role = ?'); params.push(filters.role); }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.execute(`SELECT ${ADMIN_COLUMNS} FROM AdminAccount ${where} ORDER BY Username`, params);
  return rows.map(toAdmin);
}

async function createAdmin(input, actor) {
  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  await withTransaction(async (db) => {
    try {
      await db.execute(
        `INSERT INTO AdminAccount (Username, Password, Fname, Lname, Address, Role, Email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [input.username, hash, input.firstName, input.lastName, input.address, input.role, input.email],
      );
    } catch (err) {
      if (isDuplicateKey(err)) throw duplicateError(err, input);
      throw err;
    }
    await logAction(db, actor, `CREATE AdminAccount ${input.username} (${input.role})`);
  });
  return getAdmin(input.username);
}

// Changing your own role could leave nobody able to manage accounts.
function assertNotChangingOwnRole(row, input, actor) {
  if (sameUser(row.Username, actor) && input.role !== row.Role) {
    throw new HttpError(400, 'You cannot change your own role', { role: 'cannot change your own role' });
  }
}

async function updateAdmin(username, input, actor) {
  const hash = input.password ? await bcrypt.hash(input.password, BCRYPT_COST) : null;
  const canonical = await withTransaction(async (db) => {
    const row = await findAdminRow(db, username, { lock: true });
    if (!row) throw notFound(username);
    assertNotChangingOwnRole(row, input, actor);
    try {
      await db.execute(
        `UPDATE AdminAccount SET Fname = ?, Lname = ?, Address = ?, Role = ?, Email = ?,
           Password = COALESCE(?, Password)
         WHERE Username = ?`,
        [input.firstName, input.lastName, input.address, input.role, input.email, hash, row.Username],
      );
    } catch (err) {
      if (isDuplicateKey(err)) throw duplicateError(err, { username: row.Username });
      throw err;
    }
    const changes = [describeChanges(adminLogFields(toAdmin(row)), adminLogFields(input))];
    if (hash) changes.push('password changed');
    await logAction(db, actor, `UPDATE AdminAccount ${row.Username}: ${changes.filter(Boolean).join(', ') || 'no changes'}`);
    return row.Username;
  });
  return getAdmin(canonical);
}

function adminLogFields(admin) {
  return {
    firstName: admin.firstName,
    lastName: admin.lastName,
    address: admin.address,
    role: admin.role,
    email: admin.email,
  };
}

/** The admin's own Log rows are removed with it (FK ON DELETE CASCADE). */
async function deleteAdmin(username, actor) {
  if (sameUser(username, actor)) {
    throw new HttpError(400, 'You cannot delete your own account');
  }
  await withTransaction(async (db) => {
    const [result] = await db.execute('DELETE FROM AdminAccount WHERE Username = ?', [username]);
    if (result.affectedRows === 0) throw notFound(username);
    await logAction(db, actor, `DELETE AdminAccount ${username}`);
  });
}

async function resetPassword(username, password, actor) {
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  await withTransaction(async (db) => {
    const [result] = await db.execute('UPDATE AdminAccount SET Password = ? WHERE Username = ?', [hash, username]);
    if (result.affectedRows === 0) throw notFound(username);
    await logAction(db, actor, `UPDATE AdminAccount ${username}: password reset`);
  });
}

module.exports = {
  findAdmin,
  getAdmin,
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  resetPassword,
};
