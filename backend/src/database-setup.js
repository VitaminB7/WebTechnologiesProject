// database-setup.js — เตรียมฐานข้อมูลก่อนเปิดเซิร์ฟเวอร์ (ทำให้ `npm start` ใช้ได้ทันที)
// 1) ต่อ MySQL ตามค่าใน .env ได้  -> ใช้ตัวนั้น (ถ้ายังไม่มีฐานข้อมูล จะสร้างจาก db/schema.sql + db/seed.sql ให้)
// 2) ต่อไม่ได้ (ไม่มี MySQL / รหัสผิด) -> เปิด MySQL ชั่วคราว (mysql-memory-server) พร้อมข้อมูลตัวอย่าง
//    ข้อมูลใน MySQL ชั่วคราวจะหายเมื่อปิดเซิร์ฟเวอร์
// ต้องเรียกไฟล์นี้ "ก่อน" require('./db') เพราะ pool อ่านค่า DB_* จาก process.env แค่ครั้งเดียวตอนสร้าง
const mysql = require('mysql2/promise');
const { createDB } = require('mysql-memory-server');
const { resetDatabase } = require('../scripts/db-reset');

// รหัส error ที่แปลว่า "ไม่มี MySQL ให้ใช้" (ไม่ใช่บั๊กในโค้ดเรา)
const NO_MYSQL_ERRORS = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR'];

function getDbName() {
  return process.env.DB_NAME || 'aura_rental';
}

// เปิด MySQL ชั่วคราว แล้วเปลี่ยนค่า DB_* ให้ชี้ไปที่ตัวนั้น
async function startTemporaryMysql() {
  console.log('No MySQL found, starting a temporary one (first run downloads MySQL, please wait)...');
  const tempDb = await createDB({ version: '8.4.x' });
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = String(tempDb.port);
  process.env.DB_USER = tempDb.username;
  process.env.DB_PASSWORD = '';
  await resetDatabase(getDbName());
  console.log('Temporary MySQL ready with sample data. Changes are lost when you stop the server.');
}

async function prepareDatabase() {
  // ลองต่อ MySQL ตามค่าใน .env
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      connectTimeout: 3000,
    });
  } catch (err) {
    if (!NO_MYSQL_ERRORS.includes(err.code)) {
      throw err;
    }
    await startTemporaryMysql();
    return;
  }

  // ต่อได้แล้ว: ดูว่ามีฐานข้อมูลหรือยัง ถ้ายังไม่มีก็สร้างพร้อมข้อมูลตัวอย่าง
  try {
    const [rows] = await connection.query('SHOW DATABASES LIKE ?', [getDbName()]);
    if (rows.length === 0) {
      await resetDatabase(getDbName());
      console.log(`Database ${getDbName()} was missing, created it with sample data.`);
    }
  } finally {
    await connection.end();
  }
}

module.exports = { prepareDatabase };
