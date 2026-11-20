// server.js — จุดเริ่มโปรแกรม (`npm start`)
// อ่าน .env แล้วเปิด Express สำหรับเว็บเซอร์วิส
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const app = require('./app');
const pool = require('./db');
const { seedRoomImages } = require('./helpers/seed-room-images');

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    // Make the bundled room photos available before serving the first request.
    await seedRoomImages();
    app.listen(port, () => {
      console.log(`CONDONG Web Service: http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('Web Service startup failed:', error.code || error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

start();
