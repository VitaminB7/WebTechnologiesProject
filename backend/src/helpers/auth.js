// auth.js — ตัวกั้นทาง (middleware) สำหรับ route ที่ต้องล็อกอิน
//   requireLogin      = ต้องล็อกอินก่อน (ไม่งั้นตอบ 401)
//   requireSuperAdmin = ต้องเป็น SuperAdmin (ไม่งั้นตอบ 403) ใช้ต่อจาก requireLogin เสมอ
// และ rowToAdmin() แปลงแถวจากตาราง AdminAccount เป็น object Admin ตาม API.md
const pool = require('../db');

// คอลัมน์ที่อ่านได้ — ตั้งใจ "ไม่ใส่" Password เพื่อไม่ให้รหัสผ่านหลุดออกไปทาง API
const ADMIN_COLUMNS = 'Username, Fname, Lname, Address, Role, Email, Status';

// แปลงแถวจาก DB (ชื่อคอลัมน์) -> object ที่ส่งให้หน้าเว็บ (ชื่อแบบ camelCase)
function rowToAdmin(row) {
  return {
    username: row.Username,
    firstName: row.Fname,
    lastName: row.Lname,
    displayName: row.Fname + ' ' + row.Lname,
    address: row.Address,
    role: row.Role,
    email: row.Email,
    status: row.Status,
  };
}

// อ่านข้อมูลแอดมินจาก DB ใหม่ทุกครั้งที่มี request
// เหตุผล: ถ้าแอดมินถูกลบ ถูกเปลี่ยน role หรือถูกปิดบัญชี (Inactive) ระหว่างที่ยังล็อกอินอยู่ จะมีผลทันที
async function requireLogin(req, res, next) {
  try {
    const username = req.session.username;
    if (!username) {
      return res.status(401).json({ error: { message: 'Please log in' } });
    }
    const [rows] = await pool.execute(
      `SELECT ${ADMIN_COLUMNS} FROM AdminAccount WHERE Username = ?`,
      [username],
    );
    if (rows.length === 0 || rows[0].Status !== 'Active') {
      // บัญชีถูกลบหรือถูกปิดไปแล้ว -> ล้าง session ทิ้ง
      req.session.destroy(() => {});
      return res.status(401).json({ error: { message: 'Please log in' } });
    }
    req.admin = rowToAdmin(rows[0]); // route ถัดไปใช้ req.admin ได้เลย
    next();
  } catch (err) {
    next(err);
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.admin.role !== 'SuperAdmin') {
    return res.status(403).json({ error: { message: 'You do not have permission for this action' } });
  }
  next();
}

module.exports = { requireLogin, requireSuperAdmin, rowToAdmin, ADMIN_COLUMNS };
