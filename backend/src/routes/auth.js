// routes/auth.js — ล็อกอิน / ล็อกเอาต์ / ดูว่าตอนนี้ใครล็อกอินอยู่  (/api/auth/*)
// การล็อกอินใช้ session: เซิร์ฟเวอร์จำ username ไว้ใน req.session แล้วส่ง cookie ให้เบราว์เซอร์
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireLogin, rowToAdmin, ADMIN_COLUMNS } = require('../helpers/auth');
const { isBlank, isObject, isText, hasErrors } = require('../helpers/validate');
const { runInTransaction } = require('../helpers/transaction');
const { writeLog } = require('../helpers/log');

const router = express.Router();

// รหัสผ่านปลอมไว้เทียบเมื่อไม่พบผู้ใช้ เพื่อให้ใช้เวลาตอบเท่ากัน (คนร้ายเดาไม่ได้ว่า username ไหนมีจริง)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// ตรวจ body ของการล็อกอิน คืน object errors (ว่าง = ผ่าน)
function checkLoginBody(body) {
  const errors = {};
  if (isBlank(body.username) || !isText(body.username, 100)) {
    errors.username = 'is required';
  }
  if (typeof body.password !== 'string' || body.password === '') {
    errors.password = 'is required';
  }
  return errors;
}

// ---------------------------------------------------------------
// POST /api/auth/login — ล็อกอินด้วย username หรืออีเมล + รหัสผ่าน (ทุกคนเรียกได้)
// สำเร็จ -> { data: Admin } และได้ cookie "aura.sid" / ผิด -> 401
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200)
//   method: POST   URL: http://localhost:3000/api/auth/login
//   body (raw JSON): { "username": "admin_main", "password": "Admin@1234" }
// Postman ตัวอย่างที่ 2 (ล็อกอินด้วยอีเมล → 200)
//   method: POST   URL: http://localhost:3000/api/auth/login
//   body (raw JSON): { "username": "admin@aura36.co.th", "password": "Admin@1234" }
// Postman ตัวอย่างที่ 3 (รหัสผิด → 401)
//   method: POST   URL: http://localhost:3000/api/auth/login
//   body (raw JSON): { "username": "admin_main", "password": "wrong-password" }
// Postman ตัวอย่างที่ 4 (ไม่กรอก → 400)
//   method: POST   URL: http://localhost:3000/api/auth/login
//   body (raw JSON): { "username": "" }
// ---------------------------------------------------------------
router.post('/auth/login', async (req, res, next) => {
  try {
    // 1) ตรวจข้อมูลที่ส่งมา
    let body = req.body;
    if (!isObject(body)) {
      body = {};
    }
    const errors = checkLoginBody(body);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Please check the highlighted fields', fields: errors } });
    }
    const loginName = body.username.trim();

    // 2) หาแอดมินจาก username ก่อน ถ้าไม่เจอค่อยหาจากอีเมล
    const [rows] = await pool.execute(
      `SELECT Username, Password FROM AdminAccount
       WHERE Username = ? OR Email = ?
       ORDER BY Username = ? DESC
       LIMIT 1`,
      [loginName, loginName, loginName],
    );
    let savedHash = DUMMY_HASH;
    if (rows.length > 0) {
      savedHash = rows[0].Password;
    }
    const passwordOk = await bcrypt.compare(body.password, savedHash);
    if (rows.length === 0 || !passwordOk) {
      return res.status(401).json({ error: { message: 'Invalid username or password' } });
    }
    const username = rows[0].Username;

    // บันทึก Log การล็อกอิน (ใช้ transaction เพราะ writeLog ต้องล็อกตาราง Log เพื่อจองเลข LogID)
    await runInTransaction(async (connection) => {
      await writeLog(connection, username, `LOGIN ${username}`);
    });
    const [adminRows] = await pool.execute(
      `SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ?`,
      [username],
    );

    // 3) สร้าง session ใหม่ (กันการขโมย session เดิม) แล้วจำ username ไว้
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }
      req.session.username = username;
      res.json({ data: rowToAdmin(adminRows[0]) });
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /api/auth/logout — ออกจากระบบ (ทุกคนเรียกได้ ถ้าไม่ได้ล็อกอินก็ตอบ ok เหมือนกัน)
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": { "ok": true } })
//   method: POST   URL: http://localhost:3000/api/auth/logout
// Postman ตัวอย่างที่ 2 (เช็กว่าออกจริง: เรียก GET /api/auth/me ต่อ → 401)
//   method: GET    URL: http://localhost:3000/api/auth/me
// ---------------------------------------------------------------
router.post('/auth/logout', async (req, res, next) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('aura.sid');
      res.json({ data: { ok: true } });
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /api/auth/me — ดูข้อมูลแอดมินที่ล็อกอินอยู่ (ต้องล็อกอิน)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (ล็อกอินแล้ว → 200 { "data": Admin })
//   method: GET    URL: http://localhost:3000/api/auth/me
// Postman ตัวอย่างที่ 2 (ยังไม่ล็อกอิน / ล็อกเอาต์แล้ว → 401)
//   method: GET    URL: http://localhost:3000/api/auth/me
// ---------------------------------------------------------------
router.get('/auth/me', requireLogin, async (req, res, next) => {
  try {
    // requireLogin อ่านข้อมูลแอดมินไว้ใน req.admin ให้แล้ว
    res.json({ data: req.admin });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
