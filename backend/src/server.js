// server.js — จุดเริ่มโปรแกรม (`npm start`)
// ขั้นตอน: อ่าน .env -> เตรียมฐานข้อมูล -> สร้างแอป Express -> เปิดพอร์ต
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const { prepareDatabase } = require('./database-setup');

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await prepareDatabase();
    // require app ตรงนี้ (หลังเตรียมฐานข้อมูลเสร็จ) เพราะ db.js อ่านค่า DB_* ตอนถูก require ครั้งแรก
    const app = require('./app');
    app.listen(port, () => {
      console.log(`AURA Sukhumvit 36 running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Could not prepare the database:', err.message);
    process.exitCode = 1;
  }
}

start();
