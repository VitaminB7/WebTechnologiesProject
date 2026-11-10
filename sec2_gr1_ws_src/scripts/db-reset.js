// db-reset.js — ล้างฐานข้อมูลแล้วนำเข้าไฟล์ SQL สำหรับส่งงาน
// ใช้: npm run db:reset   (ใช้ชื่อฐานข้อมูลจาก DB_NAME ใน .env ถ้าไม่ตั้งไว้ = aura_rental)
// ไฟล์เทสต์ก็เรียก resetDatabase() โดยใช้ชื่อฐานข้อมูลแยก
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const SQL_FILE = path.join(__dirname, '..', '..', 'sec2_gr1_database.sql');

async function resetDatabase(dbName) {
  // ชื่อฐานข้อมูลต้องเป็นตัวอักษร/ตัวเลข/_ เท่านั้น (กันชื่อแปลก ๆ หลุดเข้าไปใน SQL)
  if (!/^\w+$/.test(dbName)) {
    throw new Error(`Unsafe database name: ${dbName}`);
  }
  const sql = fs.readFileSync(SQL_FILE, 'utf8').replace(/\baura_rental\b/g, dbName);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true, // ให้รันไฟล์ .sql ทั้งไฟล์ได้ในครั้งเดียว
  });
  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

// ส่วนนี้ทำงานเฉพาะตอนสั่ง `node scripts/db-reset.js` ตรง ๆ (ไม่ใช่ตอนไฟล์อื่น require)
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  const dbName = process.env.DB_NAME || 'aura_rental';
  resetDatabase(dbName)
    .then(() => {
      console.log(`Database ${dbName} reset with schema + seed data.`);
    })
    .catch((err) => {
      console.error('Database reset failed:', err.message);
      process.exitCode = 1;
    });
}

module.exports = { resetDatabase };
