// db.js — สร้าง "pool" สำหรับต่อ MySQL ใช้ร่วมกันทั้งโปรแกรม
// pool = กลุ่มการเชื่อมต่อที่เปิดค้างไว้ ใครจะใช้ก็หยิบไป ใช้เสร็จก็คืน (เร็วกว่าเปิดใหม่ทุกครั้ง)
// ทุก route เรียกแบบนี้:  const [rows] = await pool.execute('SELECT ... WHERE x = ?', [value]);
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aura_rental',
  connectionLimit: 10,
  charset: 'utf8mb4',
  // ให้คอลัมน์ DECIMAL (เช่น Price) กลับมาเป็นตัวเลข ไม่ใช่ข้อความ "15000.00"
  decimalNumbers: true,
  // วันเวลาใน DB เก็บเป็นเวลา UTC (เราใช้ UTC_TIMESTAMP() ตอนบันทึก)
  timezone: 'Z',
});

module.exports = pool;
