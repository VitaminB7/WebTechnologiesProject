// เปิดเซิร์ฟเวอร์แยกสำหรับหน้า HTML, CSS และ JavaScript
const express = require('express');
const path = require('path');

const app = express();
const port = Number(process.env.FRONTEND_PORT) || 8080;
const apiOrigin = new URL(process.env.API_ORIGIN || 'http://localhost:3000').origin;

// ส่ง URL ของ Web Service ให้ api.js อ่านก่อนเรียก fetch
app.get('/js/api-config.js', (req, res) => {
  res.type('application/javascript');
  res.send('const API_ORIGIN = ' + JSON.stringify(apiOrigin) + ';');
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`CONDONG Front-end: http://localhost:${port}`);
});
