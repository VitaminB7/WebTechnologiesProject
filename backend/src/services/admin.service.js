const bcrypt = require('bcrypt');
const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const withTransaction = require('../utils/transaction');
const { toAdmin } = require('../utils/mappers');
const { logAction, describeChanges } = require('../utils/log-action');
const { isDuplicateKey, placeholders, escapeLike } = require('../utils/sql-helpers');

const BCRYPT_COST = 10;
// Password is deliberately not in this list: it must never leave the service.
const ADMIN_COLUMNS = 'Username, Fname, Lname, Address, Role, Status, UpdatedAt';

function notFound(username) {
  return new HttpError(404, `Admin ${username} not found`);
}

function sameUser(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

async function attachEmails(db, rows) {
  if (rows.length === 0) return [];
  const names = rows.map((row) => row.Username);
  const [emailRows] = await db.execute(
    `SELECT Username, Email FROM AdminEmail WHERE Username IN (${placeholders(names.length)}) ORDER BY Email`,
    names,
  );
  return rows.map((row) => toAdmin(
    row,
    emailRows.filter((e) => sameUser(e.Username, row.Username)).map((e) => e.Email),
  ));
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
  if (!row) return null;
  const [admin] = await attachEmails(pool, [row]);
  return admin;
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
    clauses.push("(Username LIKE ? OR CONCAT(Fname, ' ', Lname) LIKE ?)");
    params.push(like, like);
  }
  if (filters.role !== null) { clauses.push('Role = ?'); params.push(filters.role); }
  if (filters.status !== null) { clauses.push('Status = ?'); params.push(filters.status); }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.execute(`SELECT ${ADMIN_COLUMNS} FROM AdminAccount ${where} ORDER BY Username`, params);
  return attachEmails(pool, rows);
}

// An email identifies an admin at login, so two accounts must not share one.
async function assertEmailsFree(db, emails, ownUsername) {
  if (emails.length === 0) return;
  const [rows] = await db.execute(
    `SELECT Email FROM AdminEmail WHERE Email IN (${placeholders(emails.length)}) AND Username <> ?`,
    [...emails, ownUsername],
  );
  if (rows.length > 0) {
    throw new HttpError(409, 'Email already used by another admin', {
      emails: `already used: ${rows.map((r) => r.Email).join(', ')}`,
    });
  }
}

async function replaceEmails(db, username, emails) {
  await db.execute('DELETE FROM AdminEmail WHERE Username = ?', [username]);
  for (const email of emails) {
    try {
      await db.execute('INSERT INTO AdminEmail (Username, Email) VALUES (?, ?)', [username, email]);
    } catch (err) {
      // UNIQUE (Email) catches the race that assertEmailsFree cannot (two saves at once).
      if (isDuplicateKey(err)) {
        throw new HttpError(409, 'Email already used by another admin', { emails: `already used: ${email}` });
      }
      throw err;
    }
  }
}

async function createAdmin(input, actor) {
  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  await withTransaction(async (db) => {
    try {
      await db.execute(
        `INSERT INTO AdminAccount (Username, Password, Fname, Lname, Address, Role, Status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [input.username, hash, input.firstName, input.lastName, input.address, input.role, input.status],
      );
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new HttpError(409, `Username ${input.username} already exists`, { username: 'already exists' });
      }
      throw err;
    }
    await assertEmailsFree(db, input.emails, input.username);
    await replaceEmails(db, input.username, input.emails);
    await logAction(db, actor, `CREATE AdminAccount ${input.username} (${input.role})`);
  });
  return getAdmin(input.username);
}

// Changing your own role or status could leave nobody able to manage accounts.
function assertNotLockingSelfOut(row, input, actor) {
  if (!sameUser(row.Username, actor)) return;
  if (input.role !== row.Role || input.status !== 'active') {
    throw new HttpError(400, 'You cannot change your own role or deactivate yourself', {
      role: input.role !== row.Role ? 'cannot change your own role' : undefined,
      status: input.status !== 'active' ? 'cannot deactivate yourself' : undefined,
    });
  }
}

async function updateAdmin(username, input, actor) {
  const hash = input.password ? await bcrypt.hash(input.password, BCRYPT_COST) : null;
  const canonical = await withTransaction(async (db) => {
    const row = await findAdminRow(db, username, { lock: true });
    if (!row) throw notFound(username);
    assertNotLockingSelfOut(row, input, actor);
    await assertEmailsFree(db, input.emails, row.Username);
    const [before] = await attachEmails(db, [row]);
    await db.execute(
      `UPDATE AdminAccount SET Fname = ?, Lname = ?, Address = ?, Role = ?, Status = ?,
         Password = COALESCE(?, Password), UpdatedAt = CURRENT_TIMESTAMP
       WHERE Username = ?`,
      [input.firstName, input.lastName, input.address, input.role, input.status, hash, row.Username],
    );
    await replaceEmails(db, row.Username, input.emails);
    const changes = [describeChanges(adminLogFields(before), adminLogFields(input))];
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
    status: admin.status,
    emails: [...admin.emails].map((e) => e.toLowerCase()).sort(),
  };
}

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
    const [result] = await db.execute(
      'UPDATE AdminAccount SET Password = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE Username = ?',
      [hash, username],
    );
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
