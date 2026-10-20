// routes/logs.js — ดูประวัติการแก้ไข (ตาราง Log)  (/api/logs)  SuperAdmin เท่านั้น
const express = require('express');
const pool = require('../db');
const { requireLogin, requireSuperAdmin } = require('../helpers/auth');
const { LOG_NUMBER_SQL } = require('../helpers/log');

const router = express.Router();

// ---------------------------------------------------------------
// GET /api/logs — Log ล่าสุด 100 แถว ใหม่สุดก่อน (SuperAdmin เท่านั้น)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (ล็อกอินเป็น admin_main → 200 { "data": [{ "logId": "L-12", "username": ..., "changed": ..., "dateTime": ... }] })
//   method: GET    URL: http://localhost:3000/api/logs
// Postman ตัวอย่างที่ 2 (ล็อกอินเป็น Admin ธรรมดา เช่น listing_ploy → 403)
//   method: GET    URL: http://localhost:3000/api/logs
// Postman ตัวอย่างที่ 3 (ยังไม่ล็อกอิน → 401)
//   method: GET    URL: http://localhost:3000/api/logs
// ---------------------------------------------------------------
router.get('/logs', requireLogin, requireSuperAdmin, async (req, res, next) => {
  try {
    // 1) ไม่มีข้อมูลให้ตรวจ
    // 2) เรียงตามเวลาใหม่สุดก่อน ถ้าเวลาเท่ากันใช้เลข LogID ที่มากกว่าก่อน
    const [rows] = await pool.execute(
      `SELECT LogID, Username, Changed, DateTime FROM Log
       ORDER BY DateTime DESC, ${LOG_NUMBER_SQL} DESC
       LIMIT 100`,
    );
    // 3) แปลงชื่อคอลัมน์เป็น camelCase แล้วส่งกลับ (วันเวลาเป็นรูปแบบ ISO เช่น 2026-10-20T10:00:00.000Z)
    const logs = [];
    for (const row of rows) {
      logs.push({
        logId: row.LogID,
        username: row.Username,
        changed: row.Changed,
        dateTime: row.DateTime.toISOString(),
      });
    }
    res.json({ data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
