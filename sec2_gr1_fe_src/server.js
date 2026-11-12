// เปิดเซิร์ฟเวอร์แยกสำหรับหน้า HTML, CSS และ JavaScript
const express = require('express');
const path = require('path');

const app = express();
const port = Number(process.env.FRONTEND_PORT) || 8080;
const apiOrigin = new URL(process.env.API_ORIGIN || 'http://localhost:3000').origin;

const PUBLIC_DIR = path.join(__dirname, 'public');

// ส่ง URL ของ Web Service ให้ api.js อ่านก่อนเรียก fetch
app.get('/js/api-config.js', (req, res) => {
  res.type('application/javascript');
  res.send('const API_ORIGIN = ' + JSON.stringify(apiOrigin) + ';');
});

// ===== รวมศูนย์การจัดการ Route ของหน้าเว็บ (Page Routes) =====
// หน้าสาธารณะ (Public)
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/search', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'search.html')));
app.get('/room', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'room.html')));
app.get('/rooms/:id', (req, res) => res.redirect(`/room?id=${encodeURIComponent(req.params.id)}`));
app.get('/team', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'team.html')));
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

// หน้าระบบแอดมิน (Admin)
app.get('/admin/rooms', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'rooms.html')));
app.get('/admin/accounts', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'accounts.html')));

// เปลี่ยนเส้นทางจากลิงก์เดิมที่ลงท้ายด้วย .html ให้กลายเป็น Clean URL อัตโนมัติ
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/search.html', (req, res) => res.redirect(301, '/search'));
app.get('/room.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/room' + query);
});
app.get('/team.html', (req, res) => res.redirect(301, '/team'));
app.get('/login.html', (req, res) => res.redirect(301, '/login'));
app.get('/admin/rooms.html', (req, res) => res.redirect(301, '/admin/rooms'));
app.get('/admin/accounts.html', (req, res) => res.redirect(301, '/admin/accounts'));

// เสิร์ฟไฟล์ Static ทั่วไป (CSS, JS, รูปภาพ)
app.use(express.static(PUBLIC_DIR));

app.listen(port, () => {
  console.log(`CONDONG Front-end: http://localhost:${port}`);
});
