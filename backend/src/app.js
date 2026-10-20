// app.js — ประกอบแอป Express: ตั้งค่าส่วนกลาง (middleware) + ต่อ route ทุกไฟล์ + ตัวจัดการ error
// ไฟล์นี้แค่ "สร้าง" แอป ส่วนการเปิดพอร์ตอยู่ใน server.js (เทสต์จึง require แอปไปใช้ได้โดยไม่ต้องเปิดพอร์ต)
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const authRoutes = require('./routes/auth');
const rooms = require('./routes/rooms'); // ไฟล์นี้ส่ง router และค่าอื่น ๆ (เช่น UPLOAD_DIR) ออกมาด้วย
const roomImageRoutes = require('./routes/room-images');
const adminRoutes = require('./routes/admins');
const logRoutes = require('./routes/logs');

const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend', 'public');
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

// กุญแจเข้ารหัส cookie ของ session: ควรตั้งใน .env ถ้าไม่ตั้งจะสุ่มใหม่ทุกครั้งที่เปิดเซิร์ฟเวอร์
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn('SESSION_SECRET is not set; using a random one (sessions reset on restart).');
  sessionSecret = crypto.randomBytes(32).toString('hex');
}

const app = express();

// ===== ตั้งค่าส่วนกลาง (ทำกับทุก request) =====
app.disable('x-powered-by'); // ไม่บอกคนนอกว่าใช้ Express

// บอกเบราว์เซอร์ว่า "ห้ามเดาชนิดไฟล์เอง" (กันไฟล์ที่อัปโหลดถูกเปิดเป็นสคริปต์)
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});

// อ่าน body แบบ JSON (ใหญ่สุด 100 KB) -> req.body
app.use(express.json({ limit: '100kb' }));

// session: จำว่าใครล็อกอินอยู่ ผ่าน cookie ชื่อ aura.sid
app.use(session({
  name: 'aura.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: EIGHT_HOURS },
}));

// ===== route ของ API (ทุกอันขึ้นต้นด้วย /api) =====
app.use('/api', authRoutes);
app.use('/api', rooms.router);
app.use('/api', roomImageRoutes);
app.use('/api', adminRoutes);
app.use('/api', logRoutes);

// /api/... ที่ไม่มีจริง -> ตอบ 404 แบบ JSON (ไม่ใช่หน้า HTML ของ Express)
app.use('/api', (req, res) => {
  res.status(404).json({ error: { message: `No API route for ${req.method} ${req.baseUrl}${req.path}` } });
});

// ===== ไฟล์ทั่วไป =====
app.use('/uploads', express.static(rooms.UPLOAD_DIR)); // รูปห้อง เช่น /uploads/L-1201-a1b2c3.jpg
// TODO(ยังขาด): โจทย์ให้แยก 2 เซิร์ฟเวอร์ = Front-end server กับ Web Service server
//   ตอนนี้แอปเดียวเสิร์ฟทั้งหน้าเว็บและ API ต้องแยกหน้าเว็บไปเป็นเซิร์ฟเวอร์ของตัวเอง (เปิด CORS + cookie ข้ามพอร์ต)
//   และตั้งชื่อโฟลเดอร์ส่งงานเป็น sec2_gr1_fe_src / sec2_gr1_ws_src (rubric เว็บเซอร์วิสข้อ 12)
app.use(express.static(FRONTEND_DIR)); // หน้าเว็บ (frontend/public)

// ===== ตัวจัดการ error ตัวสุดท้าย =====
// ทุก route เรียก next(err) เมื่อเกิด error -> มาจบที่นี่
// Express รู้ว่าเป็นตัวจัดการ error เพราะมี 4 พารามิเตอร์ (ต้องมี next แม้ไม่ได้ใช้)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // อัปโหลดรูปผิดกติกา (ไฟล์ใหญ่เกิน 2 MB / เกิน 5 ไฟล์ / ชื่อช่องไม่ใช่ images)
  if (err instanceof multer.MulterError) {
    let message = 'upload with the field "images" (at most 5 files)';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'each image must be 2 MB or smaller';
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'at most 5 images per upload';
    }
    return res.status(400).json({ error: { message: 'Invalid upload', fields: { images: message } } });
  }
  // JSON ที่ส่งมาเขียนผิด
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
  }
  // body ใหญ่เกิน 100 KB
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body is too large' } });
  }
  // error อื่นจากการอ่าน body ที่เป็นความผิดของผู้ส่ง (เช่น charset ไม่รองรับ) -> ส่งรหัสเดิมกลับ
  if (err.expose === true && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: { message: err.message } });
  }
  // ข้อมูลซ้ำกับที่มีอยู่ (เช่น เลขเครื่องใช้ซ้ำ) — ปกติ route เช็กก่อนแล้ว อันนี้กันไว้อีกชั้น
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { message: 'This record already exists' } });
  }
  // อย่างอื่นทั้งหมด = บั๊กหรือ DB มีปัญหา: พิมพ์รายละเอียดใน console แต่ไม่ส่ง SQL/stack ให้ผู้ใช้
  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong on the server' } });
});

module.exports = app;
