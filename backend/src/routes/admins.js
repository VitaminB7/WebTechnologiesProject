// routes/admins.js — จัดการบัญชีแอดมิน (/api/admins*) ใช้ตาราง AdminAccount
// ทุก route ในไฟล์นี้: ต้องล็อกอิน และต้องเป็น SuperAdmin เท่านั้น (Admin ธรรมดาได้ 403)
// รหัสผ่านเก็บเป็น bcrypt hash และไม่ถูกส่งกลับไปทาง API เด็ดขาด
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const {
  requireLogin, requireSuperAdmin, rowToAdmin, ADMIN_COLUMNS,
} = require('../helpers/auth');
const {
  isBlank, isObject, isText, isEmail, isOneOf, textOrNull, hasErrors, toLikePattern,
} = require('../helpers/validate');
const { runInTransaction } = require('../helpers/transaction');
const { writeLog, describeChanges } = require('../helpers/log');

const router = express.Router();

const ROLES = ['Admin', 'SuperAdmin'];
const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,50}$/; // ตัวอักษร ตัวเลข _ . ยาว 3-50
const BCRYPT_COST = 10;

// ทุก route ต้องผ่าน 2 ด่านนี้ก่อน
const superAdminOnly = [requireLogin, requireSuperAdmin];

// ตรวจรหัสผ่าน: อย่างน้อย 8 ตัว และไม่เกิน 72 ไบต์ (bcrypt ใช้แค่ 72 ไบต์แรก ที่เกินจะถูกตัดทิ้งเงียบ ๆ)
function checkPassword(password, errors) {
  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'is required, at least 8 characters';
  } else if (Buffer.byteLength(password, 'utf8') > 72) {
    errors.password = 'must be at most 72 bytes';
  }
}

// ตรวจ body ของการเพิ่ม (isCreate = true) หรือแก้ไขแอดมิน คืน errors
function checkAdminBody(body, isCreate) {
  const errors = {};
  if (isCreate) {
    if (typeof body.username !== 'string' || !USERNAME_PATTERN.test(body.username.trim())) {
      errors.username = 'must be 3-50 letters, digits, dot or underscore';
    }
    checkPassword(body.password, errors);
  } else if (!isBlank(body.password)) {
    checkPassword(body.password, errors); // แก้ไข: เว้นว่าง = ใช้รหัสเดิม
  }
  if (isBlank(body.firstName) || !isText(body.firstName, 100)) {
    errors.firstName = 'is required (at most 100 characters)';
  }
  if (isBlank(body.lastName) || !isText(body.lastName, 100)) {
    errors.lastName = 'is required (at most 100 characters)';
  }
  if (!isBlank(body.address) && !isText(body.address, 255)) {
    errors.address = 'must be text, at most 255 characters';
  }
  if (!isOneOf(body.role, ROLES)) {
    errors.role = 'must be Admin or SuperAdmin';
  }
  if (!isBlank(body.email) && !isEmail(body.email)) {
    errors.email = 'must be a valid email (at most 100 characters)';
  }
  return errors;
}

// body ที่ตรวจผ่านแล้ว -> ข้อมูลที่สะอาด (ไม่รวม username / password)
function readAdminBody(body) {
  return {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    address: textOrNull(body.address),
    role: body.role,
    email: textOrNull(body.email),
  };
}

// มีแอดมิน "คนอื่น" ใช้อีเมลนี้อยู่แล้วหรือไม่ (เทียบแบบไม่สนตัวเล็กตัวใหญ่)
async function isEmailTaken(db, email, ownUsername) {
  if (email === null) {
    return false;
  }
  const [rows] = await db.execute(
    'SELECT Username FROM AdminAccount WHERE Email = ? AND Username <> ?',
    [email, ownUsername],
  );
  return rows.length > 0;
}

function isSameUser(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

function sendNotFound(res, username) {
  return res.status(404).json({ error: { message: `Admin ${username} not found` } });
}

function sendEmailTaken(res) {
  return res.status(409).json({
    error: { message: 'Email already used by another admin', fields: { email: 'already used by another admin' } },
  });
}

// ---------------------------------------------------------------
// GET /api/admins — รายชื่อแอดมิน ค้นได้ 3 แบบ (ใส่กี่อันก็ได้ ไม่ใส่ = ทั้งหมด)
//   q = username หรือชื่อ/นามสกุลมีคำนี้, role = Admin / SuperAdmin, email = อีเมลมีคำนี้
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง (ต้องเป็น SuperAdmin)
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": [Admin...] })
//   method: GET    URL: http://localhost:3000/api/admins?q=ploy&role=Admin&email=aura36
// Postman ตัวอย่างที่ 2 (role ผิด → 400 fields.role)
//   method: GET    URL: http://localhost:3000/api/admins?role=root
// Postman ตัวอย่างที่ 3 (ล็อกอินเป็น Admin ธรรมดา เช่น listing_ploy → 403)
//   method: GET    URL: http://localhost:3000/api/admins
// ---------------------------------------------------------------
router.get('/admins', superAdminOnly, async (req, res, next) => {
  try {
    // 1) ตรวจค่าค้นหา
    const query = req.query;
    const errors = {};
    if (!isBlank(query.q) && !isText(query.q, 100)) {
      errors.q = 'must be text, at most 100 characters';
    }
    if (!isBlank(query.role) && !isOneOf(query.role, ROLES)) {
      errors.role = 'must be Admin or SuperAdmin';
    }
    if (!isBlank(query.email) && !isText(query.email, 100)) {
      errors.email = 'must be text, at most 100 characters';
    }
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Invalid search values', fields: errors } });
    }

    // 2) สร้างเงื่อนไข WHERE เฉพาะค่าที่ส่งมา (ค่าจากผู้ใช้อยู่ใน values เสมอ)
    const conditions = [];
    const values = [];
    if (!isBlank(query.q)) {
      const pattern = toLikePattern(query.q.trim());
      conditions.push("(Username LIKE ? OR CONCAT(Fname, ' ', Lname) LIKE ?)");
      values.push(pattern, pattern);
    }
    if (!isBlank(query.role)) {
      conditions.push('Role = ?');
      values.push(query.role);
    }
    if (!isBlank(query.email)) {
      conditions.push('Email LIKE ?');
      values.push(toLikePattern(query.email.trim()));
    }
    let where = '';
    if (conditions.length > 0) {
      where = 'WHERE ' + conditions.join(' AND ');
    }
    const [rows] = await pool.execute(`SELECT ${ADMIN_COLUMNS} FROM AdminAccount ${where} ORDER BY Username`, values);

    // 3) ส่งกลับ
    const admins = [];
    for (const row of rows) {
      admins.push(rowToAdmin(row));
    }
    res.json({ data: admins });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /api/admins/:username — ดูแอดมิน 1 คน (SuperAdmin เท่านั้น)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": Admin })
//   method: GET    URL: http://localhost:3000/api/admins/listing_ploy
// Postman ตัวอย่างที่ 2 (ไม่มีคนนี้ → 404)
//   method: GET    URL: http://localhost:3000/api/admins/nobody
// ---------------------------------------------------------------
router.get('/admins/:username', superAdminOnly, async (req, res, next) => {
  try {
    // 1) ไม่มีอะไรต้องตรวจ (username อยู่ใน URL)
    // 2) อ่านจาก DB
    const [rows] = await pool.execute(
      `SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ?`,
      [req.params.username],
    );
    if (rows.length === 0) {
      return sendNotFound(res, req.params.username);
    }
    // 3) ส่งกลับ
    res.json({ data: rowToAdmin(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /api/admins — เพิ่มแอดมินใหม่ (SuperAdmin เท่านั้น) สำเร็จ → 201
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 201 { "data": Admin })
//   method: POST   URL: http://localhost:3000/api/admins
//   body (raw JSON): { "username": "staff_new", "password": "Staff@1234", "firstName": "Mana",
//                      "lastName": "Deejai", "address": "", "role": "Admin", "email": "mana@example.com" }
// Postman ตัวอย่างที่ 2 (ข้อมูลผิด → 400)
//   method: POST   URL: http://localhost:3000/api/admins
//   body (raw JSON): { "username": "a-b", "password": "short", "role": "root" }
// Postman ตัวอย่างที่ 3 (username หรืออีเมลซ้ำ → 409)
//   method: POST   URL: http://localhost:3000/api/admins   body: เหมือนตัวอย่างที่ 1 แต่ "username": "admin_main"
// ---------------------------------------------------------------
router.post('/admins', superAdminOnly, async (req, res, next) => {
  try {
    // 1) ตรวจข้อมูล
    let body = req.body;
    if (!isObject(body)) {
      body = {};
    }
    const errors = checkAdminBody(body, true);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Please check the highlighted fields', fields: errors } });
    }
    const username = body.username.trim();
    const admin = readAdminBody(body);
    const hash = await bcrypt.hash(body.password, BCRYPT_COST);

    // 2) เช็กซ้ำ แล้วบันทึก + เขียน Log
    const result = await runInTransaction(async (connection) => {
      const [existing] = await connection.execute('SELECT Username FROM AdminAccount WHERE Username = ?', [username]);
      if (existing.length > 0) {
        return 'username-taken';
      }
      if (await isEmailTaken(connection, admin.email, username)) {
        return 'email-taken';
      }
      await connection.execute(
        `INSERT INTO AdminAccount (Username, Password, Fname, Lname, Address, Role, Email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, hash, admin.firstName, admin.lastName, admin.address, admin.role, admin.email],
      );
      await writeLog(connection, req.admin.username, `CREATE AdminAccount ${username} (${admin.role})`);
      return 'created';
    });
    if (result === 'username-taken') {
      return res.status(409).json({
        error: { message: `Username ${username} already exists`, fields: { username: 'already exists' } },
      });
    }
    if (result === 'email-taken') {
      return sendEmailTaken(res);
    }

    // 3) ส่งแอดมินที่สร้างแล้วกลับไป
    const [rows] = await pool.execute(`SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ?`, [username]);
    res.status(201).json({ data: rowToAdmin(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// แก้ไขแอดมินใน transaction: คืน 'not-found' / 'own-role' / 'email-taken' หรือ Username ตัวจริงเมื่อสำเร็จ
async function updateAdmin(username, admin, hash, actor) {
  return runInTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ? FOR UPDATE`,
      [username],
    );
    if (rows.length === 0) {
      return 'not-found';
    }
    const before = rowToAdmin(rows[0]);
    // ห้ามเปลี่ยน role ตัวเอง (กันกรณีไม่เหลือใครจัดการบัญชีได้)
    if (isSameUser(before.username, actor) && admin.role !== before.role) {
      return 'own-role';
    }
    if (await isEmailTaken(connection, admin.email, before.username)) {
      return 'email-taken';
    }
    // COALESCE(?, Password) = ถ้าไม่ได้ส่งรหัสใหม่ (null) ก็ใช้รหัสเดิม
    await connection.execute(
      `UPDATE AdminAccount SET Fname = ?, Lname = ?, Address = ?, Role = ?, Email = ?,
         Password = COALESCE(?, Password)
       WHERE Username = ?`,
      [admin.firstName, admin.lastName, admin.address, admin.role, admin.email, hash, before.username],
    );
    const oldValues = {
      firstName: before.firstName,
      lastName: before.lastName,
      address: before.address,
      role: before.role,
      email: before.email,
    };
    let changes = describeChanges(oldValues, admin);
    if (hash !== null && changes === 'no changes') {
      changes = 'password changed';
    } else if (hash !== null) {
      changes = changes + ', password changed';
    }
    await writeLog(connection, actor, `UPDATE AdminAccount ${before.username}: ${changes}`);
    return before.username;
  });
}

// ---------------------------------------------------------------
// PUT /api/admins/:username — แก้ไขแอดมิน (SuperAdmin เท่านั้น) เปลี่ยน username ไม่ได้
// password เว้นว่าง = ใช้รหัสเดิม / เปลี่ยน role ของตัวเองไม่ได้ (400)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": Admin })
//   method: PUT    URL: http://localhost:3000/api/admins/listing_ploy
//   body (raw JSON): { "firstName": "Ploy", "lastName": "Srisuk", "address": "Bangkok",
//                      "role": "Admin", "email": "ploy.s@aura36.co.th", "password": "" }
// Postman ตัวอย่างที่ 2 (ล็อกอินเป็น admin_main แล้วเปลี่ยน role ตัวเอง → 400 fields.role)
//   method: PUT    URL: http://localhost:3000/api/admins/admin_main
//   body (raw JSON): { "firstName": "Somchai", "lastName": "Jaidee", "role": "Admin" }
// ---------------------------------------------------------------
router.put('/admins/:username', superAdminOnly, async (req, res, next) => {
  try {
    // 1) ตรวจข้อมูล
    let body = req.body;
    if (!isObject(body)) {
      body = {};
    }
    const errors = checkAdminBody(body, false);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Please check the highlighted fields', fields: errors } });
    }
    const admin = readAdminBody(body);
    let hash = null;
    if (!isBlank(body.password)) {
      hash = await bcrypt.hash(body.password, BCRYPT_COST);
    }

    // 2) แก้ไขใน DB
    const result = await updateAdmin(req.params.username, admin, hash, req.admin.username);
    if (result === 'not-found') {
      return sendNotFound(res, req.params.username);
    }
    if (result === 'own-role') {
      return res.status(400).json({
        error: { message: 'You cannot change your own role', fields: { role: 'cannot change your own role' } },
      });
    }
    if (result === 'email-taken') {
      return sendEmailTaken(res);
    }

    // 3) ส่งข้อมูลหลังแก้กลับไป
    const [rows] = await pool.execute(`SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ?`, [result]);
    res.json({ data: rowToAdmin(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// DELETE /api/admins/:username — ลบแอดมิน (SuperAdmin เท่านั้น) ลบตัวเองไม่ได้ (400)
// แถว Log ของคนที่ถูกลบจะถูกลบตาม (FK ON DELETE CASCADE)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": { "ok": true } })
//   method: DELETE URL: http://localhost:3000/api/admins/ops_niran
// Postman ตัวอย่างที่ 2 (ลบตัวเอง ขณะล็อกอินเป็น admin_main → 400)
//   method: DELETE URL: http://localhost:3000/api/admins/admin_main
// Postman ตัวอย่างที่ 3 (ไม่มีคนนี้ → 404)
//   method: DELETE URL: http://localhost:3000/api/admins/nobody
// ---------------------------------------------------------------
router.delete('/admins/:username', superAdminOnly, async (req, res, next) => {
  try {
    // 1) ห้ามลบตัวเอง
    const username = req.params.username;
    if (isSameUser(username, req.admin.username)) {
      return res.status(400).json({ error: { message: 'You cannot delete your own account' } });
    }

    // 2) ลบ + เขียน Log
    const deleted = await runInTransaction(async (connection) => {
      const [result] = await connection.execute('DELETE FROM AdminAccount WHERE Username = ?', [username]);
      if (result.affectedRows === 0) {
        return false;
      }
      await writeLog(connection, req.admin.username, `DELETE AdminAccount ${username}`);
      return true;
    });
    if (!deleted) {
      return sendNotFound(res, username);
    }

    // 3) ส่งกลับ
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /api/admins/:username/reset-password — ตั้งรหัสผ่านใหม่ให้แอดมิน (SuperAdmin เท่านั้น)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": { "ok": true } })
//   method: POST   URL: http://localhost:3000/api/admins/listing_ploy/reset-password
//   body (raw JSON): { "password": "NewPass@5678" }
// Postman ตัวอย่างที่ 2 (รหัสสั้นไป → 400 fields.password)
//   method: POST   URL: http://localhost:3000/api/admins/listing_ploy/reset-password
//   body (raw JSON): { "password": "short" }
// ---------------------------------------------------------------
router.post('/admins/:username/reset-password', superAdminOnly, async (req, res, next) => {
  try {
    // 1) ตรวจรหัสผ่านใหม่
    let body = req.body;
    if (!isObject(body)) {
      body = {};
    }
    const errors = {};
    checkPassword(body.password, errors);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Please check the highlighted fields', fields: errors } });
    }
    const hash = await bcrypt.hash(body.password, BCRYPT_COST);

    // 2) บันทึก hash ใหม่ + เขียน Log
    const username = req.params.username;
    const updated = await runInTransaction(async (connection) => {
      const [result] = await connection.execute('UPDATE AdminAccount SET Password = ? WHERE Username = ?', [hash, username]);
      if (result.affectedRows === 0) {
        return false;
      }
      await writeLog(connection, req.admin.username, `UPDATE AdminAccount ${username}: password reset`);
      return true;
    });
    if (!updated) {
      return sendNotFound(res, username);
    }

    // 3) ส่งกลับ
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
