// routes/room-images.js — อัปโหลด / ลบรูปของห้อง  (/api/rooms/:id/images*)
// ไฟล์รูปเก็บในโฟลเดอร์ backend/uploads และเปิดดูได้ที่ /uploads/<ชื่อไฟล์>
// ในฐานข้อมูลเก็บแค่ "ที่อยู่ไฟล์" ในตาราง RoomImage
// ใช้ multer ช่วยรับไฟล์จากฟอร์มแบบ multipart/form-data (ช่องชื่อ "images")
const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { requireLogin } = require('../helpers/auth');
const { hasErrors } = require('../helpers/validate');
const { runInTransaction } = require('../helpers/transaction');
const { writeLog } = require('../helpers/log');
const {
  UPLOAD_DIR, isRoomId, sendBadRoomId, loadRoom, deleteImageFiles,
} = require('./rooms');

const router = express.Router();

const MAX_FILES = 5;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

// นามสกุลไฟล์ที่จะบันทึก เลือกจากชนิดไฟล์ (ไม่ใช้ชื่อไฟล์ที่ผู้ใช้ส่งมา)
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ตั้งชื่อไฟล์ใหม่ เช่น L-1201-a1b2c3d4e5f6.jpg (สุ่มท้ายชื่อ กันชื่อซ้ำ)
function makeFileName(req, file, callback) {
  let prefix = 'room';
  if (isRoomId(req.params.id)) {
    prefix = req.params.id;
  }
  let extension = EXTENSIONS[file.mimetype];
  if (!extension) {
    extension = 'bin'; // ไม่ใช่รูป -> route จะลบทิ้งและตอบ 400
  }
  const randomPart = crypto.randomBytes(6).toString('hex');
  callback(null, `${prefix}-${randomPart}.${extension}`);
}

// multer: รับไฟล์จากช่อง "images" ได้ไม่เกิน 5 ไฟล์ ไฟล์ละไม่เกิน 2 MB
// ถ้าเกิน multer จะส่ง error ไปให้ตัวจัดการ error ใน app.js (ตอบ 400)
const uploadImages = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: makeFileName }),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_SIZE },
}).array('images', MAX_FILES);

// ดูชนิดรูปจาก "เนื้อไฟล์" (magic bytes = ไบต์แรก ๆ ของไฟล์) ไม่เชื่อชื่อไฟล์หรือชนิดที่ผู้ใช้บอกมา
// คืน 'image/jpeg' / 'image/png' / 'image/webp' หรือ null ถ้าไม่ใช่รูปที่รับ
function detectImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const pngStart = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  let isPng = bytes.length >= 8;
  for (let i = 0; i < pngStart.length && isPng; i++) {
    if (bytes[i] !== pngStart[i]) {
      isPng = false;
    }
  }
  if (isPng) {
    return 'image/png';
  }
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

// ตรวจทุกไฟล์ว่าเป็นรูปจริงและตรงกับชนิดที่บอกมา คืน errors
async function checkUploadedFiles(files) {
  const errors = {};
  if (files.length === 0) {
    errors.images = 'choose at least one image';
    return errors;
  }
  for (const file of files) {
    const bytes = await fs.promises.readFile(file.path);
    const realType = detectImageType(bytes);
    if (realType === null || realType !== file.mimetype) {
      errors.images = 'file is not a valid jpg, png or webp image';
    }
  }
  return errors;
}

// ลบไฟล์ที่ multer เพิ่งบันทึกไว้ (ใช้เมื่อคำขอไม่ผ่าน จะได้ไม่มีไฟล์ขยะค้าง)
async function removeSavedFiles(files) {
  const paths = [];
  for (const file of files) {
    paths.push('/uploads/' + file.filename);
  }
  await deleteImageFiles(paths);
}

// บันทึกรูปใหม่ลงตาราง RoomImage ต่อท้ายรูปเดิม + เขียน Log (ใน transaction เดียว)
// คืน 'not-found' ถ้าไม่มีห้องนี้, 'saved' ถ้าบันทึกแล้ว
async function saveImageRows(roomId, files, username) {
  return runInTransaction(async (connection) => {
    const [rooms] = await connection.execute('SELECT RoomID FROM RoomUnit WHERE RoomID = ? FOR UPDATE', [roomId]);
    if (rooms.length === 0) {
      return 'not-found';
    }
    const [orderRows] = await connection.execute(
      'SELECT COALESCE(MAX(SortOrder), -1) AS lastOrder FROM RoomImage WHERE RoomID = ?',
      [roomId],
    );
    let sortOrder = Number(orderRows[0].lastOrder) + 1;
    for (const file of files) {
      await connection.execute(
        'INSERT INTO RoomImage (RoomID, FilePath, SortOrder) VALUES (?, ?, ?)',
        [roomId, '/uploads/' + file.filename, sortOrder],
      );
      sortOrder = sortOrder + 1;
    }
    await writeLog(connection, username, `UPDATE RoomUnit ${roomId}: added ${files.length} image(s)`);
    return 'saved';
  });
}

// ---------------------------------------------------------------
// POST /api/rooms/:id/images — อัปโหลดรูปห้อง (ต้องล็อกอิน) ได้ครั้งละไม่เกิน 5 รูป
// รับเฉพาะ jpg / png / webp ไฟล์ละไม่เกิน 2 MB (ตรวจจากเนื้อไฟล์จริง) สำเร็จได้ Room ตัวเต็มกลับไป
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": Room } มี images: [{ imageId, url }])
//   method: POST   URL: http://localhost:3000/api/rooms/L-1201/images
//   body: เลือก form-data -> key "images" เปลี่ยนชนิดเป็น File -> เลือกรูป .jpg/.png (เพิ่มได้หลายแถว ชื่อ key เดิม)
// Postman ตัวอย่างที่ 2 (ไฟล์ไม่ใช่รูปจริง เช่นไฟล์ข้อความเปลี่ยนชื่อเป็น .jpg → 400 fields.images)
//   method: POST   URL: http://localhost:3000/api/rooms/L-1201/images
//   body: form-data -> key "images" (File) = fake.jpg
// Postman ตัวอย่างที่ 3 (ไม่มีห้องนี้ → 404)
//   method: POST   URL: http://localhost:3000/api/rooms/L-4242/images   body: form-data รูปจริง 1 รูป
// ---------------------------------------------------------------
router.post('/rooms/:id/images', requireLogin, uploadImages, async (req, res, next) => {
  // ถึงตรงนี้ multer บันทึกไฟล์ลงโฟลเดอร์แล้ว ถ้าคำขอไม่ผ่าน ต้องลบไฟล์ทิ้ง
  let files = req.files;
  if (!files) {
    files = [];
  }
  let saved = false; // true เมื่อบันทึกลง DB แล้ว (ห้ามลบไฟล์หลังจากนี้)
  try {
    // 1) ตรวจรหัสห้องและไฟล์
    const roomId = req.params.id;
    if (!isRoomId(roomId)) {
      await removeSavedFiles(files);
      return sendBadRoomId(res, roomId);
    }
    const errors = await checkUploadedFiles(files);
    if (hasErrors(errors)) {
      await removeSavedFiles(files);
      return res.status(400).json({ error: { message: 'Invalid image upload', fields: errors } });
    }

    // 2) บันทึกที่อยู่ไฟล์ลง RoomImage + เขียน Log
    const result = await saveImageRows(roomId, files, req.admin.username);
    if (result === 'not-found') {
      await removeSavedFiles(files);
      return res.status(404).json({ error: { message: `Room ${roomId} not found` } });
    }
    saved = true;

    // 3) ส่ง Room ตัวเต็ม (มีรูปใหม่แล้ว) กลับไป
    res.json({ data: await loadRoom(pool, roomId) });
  } catch (err) {
    if (!saved) {
      await removeSavedFiles(files);
    }
    next(err);
  }
});

// ---------------------------------------------------------------
// DELETE /api/rooms/:id/images/:imageId — ลบรูป 1 รูปของห้อง (ต้องล็อกอิน) ลบทั้งแถวใน DB และไฟล์
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": Room } รูปนั้นหายไปจาก images)
//   method: DELETE URL: http://localhost:3000/api/rooms/L-1201/images/7
// Postman ตัวอย่างที่ 2 (ไม่มีรูปนี้ในห้องนี้ → 404)
//   method: DELETE URL: http://localhost:3000/api/rooms/L-1201/images/99999
// ---------------------------------------------------------------
router.delete('/rooms/:id/images/:imageId', requireLogin, async (req, res, next) => {
  try {
    // 1) ตรวจรหัสห้องและรหัสรูป (รหัสรูปต้องเป็นตัวเลข ถ้าไม่ใช่ถือว่า "ไม่พบรูป")
    const roomId = req.params.id;
    if (!isRoomId(roomId)) {
      return sendBadRoomId(res, roomId);
    }
    if (!/^\d+$/.test(req.params.imageId)) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }
    const imageId = Number(req.params.imageId);

    // 2) ลบแถวรูป (ต้องเป็นรูปของห้องนี้เท่านั้น) + เขียน Log
    const filePath = await runInTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT FilePath FROM RoomImage WHERE RoomID = ? AND ImageID = ?',
        [roomId, imageId],
      );
      if (rows.length === 0) {
        return null;
      }
      await connection.execute('DELETE FROM RoomImage WHERE ImageID = ?', [imageId]);
      await writeLog(connection, req.admin.username, `UPDATE RoomUnit ${roomId}: removed image ${rows[0].FilePath}`);
      return rows[0].FilePath;
    });
    if (filePath === null) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }
    // ลบไฟล์หลัง commit แล้ว
    await deleteImageFiles([filePath]);

    // 3) ส่ง Room ตัวเต็มกลับไป
    res.json({ data: await loadRoom(pool, roomId) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
