/**
 * นำรูปห้องตัวอย่างที่มีในโปรเจกต์มาแสดงบนเว็บโดยอัตโนมัติ
 * server.js เรียกและรอ seedRoomImages() ให้เสร็จก่อนเปิดรับ request
 * จึงใช้ npm start ตามปกติได้ โดยไม่ต้องรันคำสั่งนำเข้ารูปแยก
 *
 * ตัวอย่างการทำงาน:
 * prototype_rooms/L-0203/L-0203-1.jpg
 *   -> คัดลอกไป uploads/prototype-L-0203-1.jpg
 *   -> เพิ่ม RoomImage ของห้อง L-0203 โดยใช้ path /uploads/prototype-L-0203-1.jpg
 *   -> API ส่ง path นี้ให้ frontend ซึ่งเติม API_ORIGIN แล้วแสดงรูป
 * app.js เปิดให้เบราว์เซอร์อ่านไฟล์ใน uploads ผ่าน URL /uploads/...
 * ฟังก์ชันนี้เพิ่มเฉพาะรูปให้ห้องที่ยังไม่มีรูป ไม่ได้สร้างข้อมูลห้องใหม่
 */
// fs จัดการไฟล์, path สร้างตำแหน่งไฟล์, pool ให้ยืม connection ของ MySQL
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const { resolveRoomImagePath } = require('./room-image-files');

// __dirname คือโฟลเดอร์ src/helpers; ย้อนขึ้นไปหาโฟลเดอร์รูปที่ root ของโปรเจกต์
const SOURCE_DIR = path.join(__dirname, '..', '..', '..', 'prototype_rooms');
// ใช้ UPLOAD_DIR จาก environment ถ้ามี ไม่เช่นนั้นใช้ sec2_gr1_ws_src/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

async function seedRoomImages() {
  // อ่านรายการพร้อมชนิดของไฟล์/โฟลเดอร์ และยืม connection เพื่อใช้ transaction
  // await รอแต่ละงานให้เสร็จก่อนทำขั้นตอนที่ต้องใช้ผลลัพธ์ของงานนั้น
  const folders = await fs.promises.readdir(SOURCE_DIR, { withFileTypes: true });
  const connection = await pool.getConnection();
  // imported นับจำนวนรูปที่เพิ่มสำเร็จ ส่วน skipped นับจำนวนห้องที่ข้าม
  let imported = 0;
  let skipped = 0;
  try {
    // สร้าง uploads หากยังไม่มี โดยไม่ลบเนื้อหาของโฟลเดอร์ที่มีอยู่แล้ว
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    for (const folder of folders) {
      // รับเฉพาะโฟลเดอร์ชื่อ L- ตามด้วยเลข 4 หลัก เช่น L-0203; ข้าม _removed
      if (!folder.isDirectory() || !/^L-\d{4}$/.test(folder.name)) continue;
      const roomId = folder.name;
      const source = path.join(SOURCE_DIR, roomId);
      // รับไฟล์ชื่อ <รหัสห้อง>-<ลำดับ> และนามสกุล jpg/jpeg/png/webp เท่านั้น
      // แปลงเป็นรายชื่อไฟล์และเรียงตามเลข เช่น 1, 2, 10 เพื่อให้รูปแรกเป็นภาพปก
      const files = (await fs.promises.readdir(source, { withFileTypes: true }))
        .filter((file) => file.isFile() && new RegExp('^' + roomId + '-\\d+\\.(jpg|jpeg|png|webp)$', 'i').test(file.name))
        .map((file) => file.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (files.length === 0) continue; // ไม่มีไฟล์ตรงรูปแบบก็ไปห้องถัดไป

      // บันทึกรูปของแต่ละห้องเป็น transaction: สำเร็จทั้งชุด หรือยกเลิกข้อมูลชุดนั้น
      await connection.beginTransaction();
      try {
        // FOR UPDATE ล็อกแถวห้องระหว่าง transaction เพื่อประสานกับงานที่ล็อกห้องเดียวกัน
        const [rooms] = await connection.execute('SELECT RoomID FROM RoomUnit WHERE RoomID = ? FOR UPDATE', [roomId]);
        const [images] = await connection.execute('SELECT ImageID, FilePath FROM RoomImage WHERE RoomID = ?', [roomId]);
        // ลบแถวรูปที่ไฟล์ไม่มีอยู่จริงใน uploads (เช่น ฐานข้อมูลมาจากโปรเจกต์ชุดอื่น)
        // แถวเหล่านี้แสดงรูปไม่ได้อยู่แล้ว ถ้าเก็บไว้ ห้องจะถูกข้ามและเป็นกล่องเทาตลอด
        // รูปที่ไฟล์ยังอยู่ (รวมรูปที่แอดมินอัปโหลด) ไม่ถูกแตะ
        let validImages = 0;
        for (const image of images) {
          // Bundled originals also count as available on a fresh clone.
          // Missing uploads must not discard valid RoomImage rows or IDs.
          if (resolveRoomImagePath(image.FilePath)) {
            validImages++;
          } else {
            await connection.execute('DELETE FROM RoomImage WHERE ImageID = ?', [image.ImageID]);
          }
        }
        if (validImages < images.length) {
          console.log(roomId + ': removed ' + (images.length - validImages) + ' image rows with missing files');
        }
        // ข้ามห้องที่ไม่มีในฐานข้อมูลหรือมีรูปที่ใช้ได้แล้ว จึงไม่เพิ่มซ้ำเมื่อเปิดเซิร์ฟเวอร์ใหม่
        // และไม่แทนที่รูปที่แอดมินอัปโหลดไว้
        if (rooms.length === 0 || validImages > 0) {
          await connection.commit();
          skipped++;
          continue;
        }
        for (let i = 0; i < files.length; i++) {
          // เติม prototype- เพื่อแยกชื่อรูปตัวอย่างจากชื่อรูปที่อัปโหลดตามปกติ
          const filename = 'prototype-' + files[i];
          const destination = path.join(UPLOAD_DIR, filename);
          try {
            // คัดลอกโดยเก็บไฟล์ต้นฉบับไว้; COPYFILE_EXCL ป้องกันการเขียนทับไฟล์เดิม
            await fs.promises.copyFile(path.join(source, files[i]), destination, fs.constants.COPYFILE_EXCL);
          } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            // ถ้าไฟล์ปลายทางมีอยู่แล้ว ต้องมีเนื้อหาเหมือนต้นฉบับจึงใช้ต่อได้
            // รองรับการลองใหม่หลังคัดลอกไฟล์สำเร็จแต่บันทึกฐานข้อมูลไม่สำเร็จ
            const original = await fs.promises.readFile(path.join(source, files[i]));
            const existing = await fs.promises.readFile(destination);
            if (!original.equals(existing)) throw new Error('Existing photo differs: ' + filename);
          }
          // เก็บเฉพาะ URL path ไม่ได้เก็บตัวรูปลง MySQL; ? แยกค่าจากคำสั่ง SQL
          // SortOrder เริ่มที่ 0 และใช้กำหนดลำดับรูปเมื่อ API อ่านกลับไปแสดง
          await connection.execute(
            'INSERT INTO RoomImage (RoomID, FilePath, SortOrder) VALUES (?, ?, ?)',
            [roomId, '/uploads/' + filename, i],
          );
        }
        // ยืนยันข้อมูลเมื่อเพิ่มรูปของห้องนี้ครบแล้ว จึงนับและรายงานจำนวนที่นำเข้า
        await connection.commit();
        imported += files.length;
        console.log(roomId + ': imported ' + files.length + ' photos');
      } catch (error) {
        // ยกเลิกเฉพาะการเปลี่ยนแปลงในฐานข้อมูลของห้องนี้ แล้วส่ง error ให้ server.js
        // ไฟล์ที่คัดลอกแล้วจะยังอยู่ และห้องที่ commit ก่อนหน้านี้จะไม่ถูกย้อนกลับ
        await connection.rollback();
        throw error;
      }
    }
    console.log('Imported ' + imported + ' photos. Skipped ' + skipped + ' rooms (already have photos or not in database).');
  } finally {
    // คืน connection ให้ pool เสมอ ทั้งกรณีสำเร็จและเกิด error เพื่อให้งานอื่นใช้ต่อ
    connection.release();
  }
}

// ส่งฟังก์ชันให้ server.js เรียก; การ require ไฟล์นี้อย่างเดียวยังไม่เริ่มนำเข้ารูป
module.exports = { seedRoomImages };
