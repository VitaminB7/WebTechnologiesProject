// server.js — จุดเริ่มโปรแกรม (`npm start`)
// อ่าน .env แล้วเปิด Express สำหรับเว็บเซอร์วิส
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const app = require('./app');

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`CONDONG Web Service: http://localhost:${port}/api`);
});
