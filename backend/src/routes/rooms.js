// routes/rooms.js — ข้อมูลห้องเช่า: ค้นหา / ดูห้อง / ห้องคล้ายกัน / สถิติหน้าแรก / เพิ่ม แก้ ลบห้อง
// ใช้ตาราง RoomUnit (ข้อมูลห้อง) + Appliance (เครื่องใช้ในห้อง) + RoomImage (รูปห้อง)
// อ่านข้อมูล: ทุกคนเรียกได้ / เพิ่ม แก้ ลบ: ต้องล็อกอิน (Admin หรือ SuperAdmin)
const fs = require('fs');
const path = require('path');
const express = require('express');
const pool = require('../db');
const { requireLogin } = require('../helpers/auth');
const {
  isBlank, isObject, isText, toNumber, isIntBetween, isNumberBetween, isEmail, isOneOf,
  isBoolean, toBoolean, textOrNull, hasErrors, toLikePattern,
} = require('../helpers/validate');
const { runInTransaction } = require('../helpers/transaction');
const { writeLog, describeChanges } = require('../helpers/log');

const router = express.Router();

const ROOM_TYPES = ['Studio', '1 Bedroom', '2 Bedroom', 'Deluxe room'];
const ROOM_ID_PATTERN = /^L-\d{4}$/; // L- ตามด้วยตัวเลข 4 หลัก เช่น L-1201
const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/; // 000-000-0000
const MAX_PRICE = 999999.99;

// การเรียงผลค้นหา: ผู้ใช้เลือกได้แค่ "ชื่อ" (key) ส่วนข้อความ SQL เรากำหนดเองทั้งหมด
const SORT_SQL = {
  roomId: 'RoomID ASC',
  price_asc: 'Price ASC, RoomID ASC',
  price_desc: 'Price DESC, RoomID ASC',
};

// โฟลเดอร์เก็บรูปห้อง (เทสต์ตั้ง UPLOAD_DIR เป็นโฟลเดอร์ชั่วคราว จะได้ไม่ปนกับรูปจริง)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

function isRoomId(value) {
  return typeof value === 'string' && ROOM_ID_PATTERN.test(value);
}

// ตอบ 400 เมื่อ :id ใน URL ไม่ใช่รูปแบบ L-xxxx
function sendBadRoomId(res, id) {
  return res.status(400).json({
    error: { message: `Invalid room id ${id}`, fields: { roomId: 'must be L- followed by 4 digits' } },
  });
}

// ===== แปลงข้อมูลจาก DB เป็น object Room ตาม API.md =====

function rowToRoom(row, appliances, images) {
  return {
    roomId: row.RoomID,
    building: row.Building,
    floor: row.Floor,
    roomType: row.RoomType,
    bedrooms: row.NumberOfBedroom,
    size: row.RoomSize,
    price: row.Price,
    description: row.RoomConditions,
    conditionRating: row.ConditionRating,
    minimumLease: row.MinimumLeases,
    available: row.Availability === 1,
    appliances: appliances,
    images: images,
    owner: {
      name: row.OwnerName,
      phone: row.OwnerPhoneNumber,
      email: row.OwnerEmail,
      lineId: row.OwnerLineID,
    },
  };
}

// อ่านเครื่องใช้ + รูปของห้องนี้ แล้วรวมเป็น Room ตัวเต็ม
// db = pool หรือ connection ของ transaction ก็ได้
async function addDetails(db, row) {
  const [applianceRows] = await db.execute(
    `SELECT Serial_number, Name_appliance FROM Appliance
     WHERE RoomID = ? ORDER BY Name_appliance, Serial_number`,
    [row.RoomID],
  );
  const appliances = [];
  for (const item of applianceRows) {
    appliances.push({ serialNumber: item.Serial_number, name: item.Name_appliance });
  }
  const [imageRows] = await db.execute(
    'SELECT ImageID, FilePath FROM RoomImage WHERE RoomID = ? ORDER BY SortOrder, ImageID',
    [row.RoomID],
  );
  const images = [];
  for (const image of imageRows) {
    images.push({ imageId: image.ImageID, url: image.FilePath });
  }
  return rowToRoom(row, appliances, images);
}

// อ่านห้อง 1 ห้องแบบเต็ม คืน null ถ้าไม่มีห้องนี้ (room-images.js ก็ใช้ฟังก์ชันนี้)
async function loadRoom(db, roomId) {
  const [rows] = await db.execute('SELECT * FROM RoomUnit WHERE RoomID = ?', [roomId]);
  if (rows.length === 0) {
    return null;
  }
  return addDetails(db, rows[0]);
}

// ลบไฟล์รูปออกจากโฟลเดอร์ uploads (ไฟล์ที่ไม่มีอยู่แล้วก็ข้ามไป)
// filePaths เช่น ['/uploads/L-1201-a1b2c3.jpg']
async function deleteImageFiles(filePaths) {
  for (const filePath of filePaths) {
    // path.basename เอาแค่ชื่อไฟล์ -> ลบได้เฉพาะไฟล์ในโฟลเดอร์ uploads เท่านั้น
    const fullPath = path.join(UPLOAD_DIR, path.basename(filePath));
    try {
      await fs.promises.unlink(fullPath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Could not delete ${fullPath}:`, err.message);
      }
    }
  }
}

// ===== ตรวจข้อมูลห้องที่ส่งมา (ใช้ทั้งเพิ่มและแก้ไข) =====

// ตรวจช่องหลักของห้อง แล้วเขียนข้อผิดพลาดลง errors
function checkRoomFields(body, errors) {
  if (isBlank(body.building) || !isText(body.building, 100)) {
    errors.building = 'is required (at most 100 characters)';
  }
  if (!isIntBetween(body.floor, 1, 99)) {
    errors.floor = 'is required, a whole number 1-99';
  }
  if (!isOneOf(body.roomType, ROOM_TYPES)) {
    errors.roomType = 'must be one of: ' + ROOM_TYPES.join(', ');
  }
  if (!isIntBetween(body.bedrooms, 0, 10)) {
    errors.bedrooms = 'is required, a whole number 0-10';
  }
  if (!isBlank(body.size) && !isNumberBetween(body.size, 1, 500)) {
    errors.size = 'must be a number 1-500';
  }
  if (!isNumberBetween(body.price, 0, MAX_PRICE)) {
    errors.price = 'is required, a number 0-999999.99';
  }
  if (!isBlank(body.description) && !isText(body.description, 5000)) {
    errors.description = 'must be text, at most 5000 characters';
  }
  if (!isIntBetween(body.conditionRating, 1, 5)) {
    errors.conditionRating = 'is required, a whole number 1-5';
  }
  if (!isBlank(body.minimumLease) && !isIntBetween(body.minimumLease, 1, 36)) {
    errors.minimumLease = 'must be a whole number 1-36';
  }
  if (!isBoolean(body.available)) {
    errors.available = 'must be true or false';
  }
}

// ตรวจข้อมูลเจ้าของห้อง (key ของ error ใช้จุด เช่น owner.phone ตาม API.md)
function checkOwnerFields(owner, errors) {
  if (isBlank(owner.name) || !isText(owner.name, 150)) {
    errors['owner.name'] = 'is required (at most 150 characters)';
  }
  if (typeof owner.phone !== 'string' || !PHONE_PATTERN.test(owner.phone.trim())) {
    errors['owner.phone'] = 'is required, format 000-000-0000';
  }
  if (!isBlank(owner.email) && !isEmail(owner.email)) {
    errors['owner.email'] = 'must be a valid email (at most 100 characters)';
  }
  if (!isBlank(owner.lineId) && !isText(owner.lineId, 50)) {
    errors['owner.lineId'] = 'must be text, at most 50 characters';
  }
}

// ตรวจรายการเครื่องใช้ เช่น appliances.0.serialNumber
function checkAppliances(list, errors) {
  if (isBlank(list)) {
    return; // ไม่ส่งมา = ไม่มีเครื่องใช้
  }
  if (!Array.isArray(list)) {
    errors.appliances = 'must be a list';
    return;
  }
  const usedSerials = []; // เลขเครื่องที่เจอแล้ว (ตัวเล็ก) — ห้ามซ้ำในห้องเดียวกัน
  for (let i = 0; i < list.length; i++) {
    let item = list[i];
    if (!isObject(item)) {
      item = {};
    }
    if (isBlank(item.serialNumber) || !isText(item.serialNumber, 50)) {
      errors[`appliances.${i}.serialNumber`] = 'is required (at most 50 characters)';
    } else if (usedSerials.includes(item.serialNumber.trim().toLowerCase())) {
      errors[`appliances.${i}.serialNumber`] = 'is used twice in this room';
    } else {
      usedSerials.push(item.serialNumber.trim().toLowerCase());
    }
    if (isBlank(item.name) || !isText(item.name, 100)) {
      errors[`appliances.${i}.name`] = 'is required (at most 100 characters)';
    }
  }
}

// ตรวจ body ทั้งหมด คืน errors (object ว่าง = ผ่าน)
function checkRoomBody(body, checkRoomId) {
  const errors = {};
  if (checkRoomId && !isRoomId(body.roomId)) {
    errors.roomId = 'must be L- followed by 4 digits, e.g. L-1201';
  }
  checkRoomFields(body, errors);
  let owner = body.owner;
  if (!isObject(owner)) {
    owner = {};
  }
  checkOwnerFields(owner, errors);
  checkAppliances(body.appliances, errors);
  return errors;
}

// เปลี่ยน body ที่ตรวจผ่านแล้ว เป็นข้อมูลห้องที่สะอาด (ตัดช่องว่าง, แปลงเป็นตัวเลข, ค่าว่าง -> null)
function readRoomBody(body, roomId) {
  const appliances = [];
  if (Array.isArray(body.appliances)) {
    for (const item of body.appliances) {
      appliances.push({ serialNumber: item.serialNumber.trim(), name: item.name.trim() });
    }
  }
  let size = null;
  if (!isBlank(body.size)) {
    size = toNumber(body.size);
  }
  let minimumLease = null;
  if (!isBlank(body.minimumLease)) {
    minimumLease = toNumber(body.minimumLease);
  }
  return {
    roomId: roomId,
    building: body.building.trim(),
    floor: toNumber(body.floor),
    roomType: body.roomType,
    bedrooms: toNumber(body.bedrooms),
    size: size,
    price: toNumber(body.price),
    description: textOrNull(body.description),
    conditionRating: toNumber(body.conditionRating),
    minimumLease: minimumLease,
    available: toBoolean(body.available),
    appliances: appliances,
    owner: {
      name: body.owner.name.trim(),
      phone: body.owner.phone.trim(),
      email: textOrNull(body.owner.email),
      lineId: textOrNull(body.owner.lineId),
    },
  };
}

// ===== ใช้ตอนบันทึก =====

// ค่าที่จะใส่ใน INSERT / UPDATE (เรียงตามคอลัมน์ใน SQL)
function roomValues(room) {
  return [
    room.building, room.floor, room.roomType, room.bedrooms, room.size, room.price,
    room.description, room.conditionRating, room.minimumLease, room.available ? 1 : 0,
    room.owner.name, room.owner.phone, room.owner.email, room.owner.lineId,
  ];
}

// ลบเครื่องใช้เดิมของห้องทั้งหมด แล้วใส่รายการใหม่
async function saveAppliances(connection, roomId, appliances) {
  await connection.execute('DELETE FROM Appliance WHERE RoomID = ?', [roomId]);
  for (const item of appliances) {
    await connection.execute(
      'INSERT INTO Appliance (Serial_number, RoomID, Name_appliance) VALUES (?, ?, ?)',
      [item.serialNumber, roomId, item.name],
    );
  }
}

// ทำห้องให้เป็น object ชั้นเดียว เพื่อให้ describeChanges() เทียบก่อน/หลังแก้ได้
function roomForLog(room) {
  const applianceTexts = [];
  for (const item of room.appliances) {
    applianceTexts.push(item.serialNumber + ' ' + item.name);
  }
  applianceTexts.sort();
  return {
    building: room.building,
    floor: room.floor,
    roomType: room.roomType,
    bedrooms: room.bedrooms,
    size: room.size,
    price: room.price,
    description: room.description,
    conditionRating: room.conditionRating,
    minimumLease: room.minimumLease,
    available: room.available,
    ownerName: room.owner.name,
    ownerPhone: room.owner.phone,
    ownerEmail: room.owner.email,
    ownerLineId: room.owner.lineId,
    appliances: '[' + applianceTexts.join(', ') + ']',
  };
}

// ===== ค้นหาห้อง =====

// ตรวจค่าค้นหาใน URL (ทุกค่าไม่บังคับ) คืน errors
function checkSearchQuery(query) {
  const errors = {};
  if (!isBlank(query.type) && !isOneOf(query.type, ROOM_TYPES)) {
    errors.type = 'must be one of: ' + ROOM_TYPES.join(', ');
  }
  if (!isBlank(query.minPrice) && !isNumberBetween(query.minPrice, 0, MAX_PRICE)) {
    errors.minPrice = 'must be a number 0-999999.99';
  }
  if (!isBlank(query.maxPrice) && !isNumberBetween(query.maxPrice, 0, MAX_PRICE)) {
    errors.maxPrice = 'must be a number 0-999999.99';
  } else if (!isBlank(query.minPrice) && !isBlank(query.maxPrice)
    && toNumber(query.minPrice) > toNumber(query.maxPrice)) {
    errors.maxPrice = 'must be >= minPrice';
  }
  if (!isBlank(query.bedrooms) && !isIntBetween(query.bedrooms, 0, 10)) {
    errors.bedrooms = 'must be a whole number 0-10';
  }
  if (!isBlank(query.available) && !isBoolean(query.available)) {
    errors.available = 'must be true or false';
  }
  if (!isBlank(query.floor) && !isIntBetween(query.floor, 1, 99)) {
    errors.floor = 'must be a whole number 1-99';
  }
  if (!isBlank(query.minCondition) && !isIntBetween(query.minCondition, 1, 5)) {
    errors.minCondition = 'must be a whole number 1-5';
  }
  if (!isBlank(query.q) && !isText(query.q, 100)) {
    errors.q = 'must be text, at most 100 characters';
  }
  checkPagingQuery(query, errors);
  return errors;
}

// ตรวจ page / pageSize / sort
function checkPagingQuery(query, errors) {
  if (!isBlank(query.page) && !isIntBetween(query.page, 1, 100000)) {
    errors.page = 'must be a whole number from 1';
  }
  if (!isBlank(query.pageSize) && !isIntBetween(query.pageSize, 1, 50)) {
    errors.pageSize = 'must be a whole number 1-50';
  }
  if (!isBlank(query.sort) && !isOneOf(query.sort, Object.keys(SORT_SQL))) {
    errors.sort = 'must be one of: roomId, price_asc, price_desc';
  }
}

// สร้างส่วน WHERE ของ SQL จากค่าค้นหา
// conditions เก็บข้อความ SQL ที่เราเขียนเอง (มีแต่ ?) ส่วนค่าจากผู้ใช้อยู่ใน values เสมอ
function buildSearchWhere(query) {
  const conditions = [];
  const values = [];
  if (!isBlank(query.type)) {
    conditions.push('RoomType = ?');
    values.push(query.type);
  }
  if (!isBlank(query.minPrice)) {
    conditions.push('Price >= ?');
    values.push(toNumber(query.minPrice));
  }
  if (!isBlank(query.maxPrice)) {
    conditions.push('Price <= ?');
    values.push(toNumber(query.maxPrice));
  }
  if (!isBlank(query.bedrooms)) {
    conditions.push('NumberOfBedroom = ?');
    values.push(toNumber(query.bedrooms));
  }
  if (!isBlank(query.available)) {
    conditions.push('Availability = ?');
    values.push(toBoolean(query.available) ? 1 : 0);
  }
  if (!isBlank(query.floor)) {
    conditions.push('Floor = ?');
    values.push(toNumber(query.floor));
  }
  if (!isBlank(query.minCondition)) {
    conditions.push('ConditionRating >= ?');
    values.push(toNumber(query.minCondition));
  }
  if (!isBlank(query.q)) {
    conditions.push('(RoomID LIKE ? OR OwnerName LIKE ?)');
    values.push(toLikePattern(query.q.trim()), toLikePattern(query.q.trim()));
  }
  let where = '';
  if (conditions.length > 0) {
    where = 'WHERE ' + conditions.join(' AND ');
  }
  return { where: where, values: values };
}

// ---------------------------------------------------------------
// GET /api/stats — ตัวเลขการ์ด 3 ใบในหน้าแรก (ทุกคนเรียกได้)
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": { "totalRooms": 20, "roomTypes": 4, "availableRooms": 15 } })
//   method: GET    URL: http://localhost:3000/api/stats
// Postman ตัวอย่างที่ 2 (พิมพ์ path ผิด → 404 { "error": { "message": "No API route ..." } })
//   method: GET    URL: http://localhost:3000/api/stat
// ---------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    // 1) ไม่มีข้อมูลให้ตรวจ
    // 2) นับห้องทั้งหมด / จำนวนประเภทห้อง / ห้องว่าง
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS totalRooms,
              COUNT(DISTINCT RoomType) AS roomTypes,
              COALESCE(SUM(Availability), 0) AS availableRooms
       FROM RoomUnit`,
    );
    // 3) ส่งกลับ (ใช้ Number() ให้แน่ใจว่าเป็นตัวเลข)
    res.json({
      data: {
        totalRooms: Number(rows[0].totalRooms),
        roomTypes: Number(rows[0].roomTypes),
        availableRooms: Number(rows[0].availableRooms),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /api/rooms — ค้นหาห้อง (ทุกคนเรียกได้) ทุกค่าไม่บังคับ:
//   type, minPrice, maxPrice, bedrooms, available, floor, minCondition, q, page, pageSize, sort
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": [Room...], "meta": { "page": 1, "pageSize": 12, "total": 20 } })
//   method: GET    URL: http://localhost:3000/api/rooms
// Postman ตัวอย่างที่ 2 (กรองหลายค่า → 200)
//   method: GET    URL: http://localhost:3000/api/rooms?type=Deluxe%20room&floor=12&minCondition=3&available=true
// Postman ตัวอย่างที่ 3 (ค่าผิด → 400 fields.minCondition)
//   method: GET    URL: http://localhost:3000/api/rooms?minCondition=9
// ---------------------------------------------------------------
router.get('/rooms', async (req, res, next) => {
  try {
    // 1) ตรวจค่าค้นหา
    const errors = checkSearchQuery(req.query);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Invalid search values', fields: errors } });
    }
    let page = 1;
    if (!isBlank(req.query.page)) {
      page = toNumber(req.query.page);
    }
    let pageSize = 12;
    if (!isBlank(req.query.pageSize)) {
      pageSize = toNumber(req.query.pageSize);
    }
    let sort = 'roomId';
    if (!isBlank(req.query.sort)) {
      sort = req.query.sort;
    }

    // 2) นับจำนวนทั้งหมด แล้วดึงเฉพาะหน้าที่ขอ
    const search = buildSearchWhere(req.query);
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM RoomUnit ${search.where}`, search.values);
    const offset = (page - 1) * pageSize;
    // LIMIT/OFFSET ของ pool.execute ต้องส่งเป็นข้อความ (ข้อจำกัดของ MySQL 8)
    const [rows] = await pool.execute(
      `SELECT * FROM RoomUnit ${search.where} ORDER BY ${SORT_SQL[sort]} LIMIT ? OFFSET ?`,
      search.values.concat([String(pageSize), String(offset)]),
    );
    const rooms = [];
    for (const row of rows) {
      rooms.push(await addDetails(pool, row));
    }

    // 3) ส่งกลับ
    res.json({ data: rooms, meta: { page: page, pageSize: pageSize, total: countRows[0].total } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /api/rooms/:id — ดูห้อง 1 ห้อง (ทุกคนเรียกได้)
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": Room })
//   method: GET    URL: http://localhost:3000/api/rooms/L-1201
// Postman ตัวอย่างที่ 2 (ไม่มีห้องนี้ → 404)
//   method: GET    URL: http://localhost:3000/api/rooms/L-4242
// Postman ตัวอย่างที่ 3 (รหัสห้องผิดรูปแบบ → 400)
//   method: GET    URL: http://localhost:3000/api/rooms/1201
// ---------------------------------------------------------------
router.get('/rooms/:id', async (req, res, next) => {
  try {
    // 1) ตรวจรหัสห้อง
    if (!isRoomId(req.params.id)) {
      return sendBadRoomId(res, req.params.id);
    }
    // 2) อ่านห้อง
    const room = await loadRoom(pool, req.params.id);
    if (room === null) {
      return res.status(404).json({ error: { message: `Room ${req.params.id} not found` } });
    }
    // 3) ส่งกลับ
    res.json({ data: room });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// GET /api/rooms/:id/similar — ห้องคล้ายกันไม่เกิน 3 ห้อง (ประเภทเดียวกัน ห้องว่างก่อน ราคาใกล้สุด)
// ทุกคนเรียกได้
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": [Room, Room, Room] })
//   method: GET    URL: http://localhost:3000/api/rooms/L-1201/similar
// Postman ตัวอย่างที่ 2 (ไม่มีห้องนี้ → 404)
//   method: GET    URL: http://localhost:3000/api/rooms/L-4242/similar
// ---------------------------------------------------------------
router.get('/rooms/:id/similar', async (req, res, next) => {
  try {
    // 1) ตรวจรหัสห้อง
    if (!isRoomId(req.params.id)) {
      return sendBadRoomId(res, req.params.id);
    }
    // 2) หาห้องต้นแบบ แล้วหาห้องประเภทเดียวกัน
    const [found] = await pool.execute('SELECT RoomType, Price FROM RoomUnit WHERE RoomID = ?', [req.params.id]);
    if (found.length === 0) {
      return res.status(404).json({ error: { message: `Room ${req.params.id} not found` } });
    }
    const [rows] = await pool.execute(
      `SELECT * FROM RoomUnit
       WHERE RoomType = ? AND RoomID <> ?
       ORDER BY Availability DESC, ABS(Price - ?), RoomID
       LIMIT 3`,
      [found[0].RoomType, req.params.id, found[0].Price],
    );
    const rooms = [];
    for (const row of rows) {
      rooms.push(await addDetails(pool, row));
    }
    // 3) ส่งกลับ
    res.json({ data: rooms });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// POST /api/rooms — เพิ่มห้องใหม่ (ต้องล็อกอิน: Admin หรือ SuperAdmin)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 201 { "data": Room })
//   method: POST   URL: http://localhost:3000/api/rooms
//   body (raw JSON):
//   { "roomId": "L-1999", "building": "Building A", "floor": 19, "roomType": "Studio",
//     "bedrooms": 0, "size": 24, "price": 9000, "description": "New studio", "conditionRating": 4,
//     "minimumLease": 6, "available": true,
//     "appliances": [{ "serialNumber": "TV-1999-01", "name": "TV" }],
//     "owner": { "name": "Somsak Dee", "phone": "081-111-2222", "email": "", "lineId": "" } }
// Postman ตัวอย่างที่ 2 (ข้อมูลผิด → 400 fields.floor, fields.conditionRating, fields.owner.phone ...)
//   method: POST   URL: http://localhost:3000/api/rooms
//   body (raw JSON): { "roomId": "L-1999", "floor": 0, "conditionRating": 9, "owner": { "phone": "0811112222" } }
// Postman ตัวอย่างที่ 3 (รหัสห้องซ้ำ → 409)
//   method: POST   URL: http://localhost:3000/api/rooms   body: เหมือนตัวอย่างที่ 1 แต่ "roomId": "L-1201"
// ---------------------------------------------------------------
router.post('/rooms', requireLogin, async (req, res, next) => {
  try {
    // 1) ตรวจข้อมูล
    let body = req.body;
    if (!isObject(body)) {
      body = {};
    }
    const errors = checkRoomBody(body, true);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Please check the highlighted fields', fields: errors } });
    }
    const room = readRoomBody(body, body.roomId);

    // 2) บันทึกห้อง + เครื่องใช้ + Log ใน transaction เดียว
    const result = await runInTransaction(async (connection) => {
      const [existing] = await connection.execute('SELECT RoomID FROM RoomUnit WHERE RoomID = ?', [room.roomId]);
      if (existing.length > 0) {
        return 'duplicate';
      }
      await connection.execute(
        `INSERT INTO RoomUnit (RoomID, Building, Floor, RoomType, NumberOfBedroom, RoomSize, Price,
           RoomConditions, ConditionRating, MinimumLeases, Availability,
           OwnerName, OwnerPhoneNumber, OwnerEmail, OwnerLineID)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [room.roomId].concat(roomValues(room)),
      );
      await saveAppliances(connection, room.roomId, room.appliances);
      await writeLog(connection, req.admin.username, `CREATE RoomUnit ${room.roomId}`);
      return 'created';
    });
    if (result === 'duplicate') {
      return res.status(409).json({
        error: { message: `Room ${room.roomId} already exists`, fields: { roomId: 'already exists' } },
      });
    }

    // 3) ส่งห้องที่บันทึกแล้วกลับไป
    res.status(201).json({ data: await loadRoom(pool, room.roomId) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// PUT /api/rooms/:id — แก้ไขห้องทั้งก้อน (ต้องล็อกอิน) roomId ใน body ไม่ถูกใช้ (ใช้ :id จาก URL)
// เครื่องใช้ถูกแทนที่ด้วยรายการใหม่ทั้งหมด / รูปไม่เปลี่ยน (จัดการรูปที่ /api/rooms/:id/images)
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": Room })
//   method: PUT    URL: http://localhost:3000/api/rooms/L-1201
//   body (raw JSON): เหมือน POST แต่แก้ค่า เช่น "price": 16000, "floor": 12, "conditionRating": 4
// Postman ตัวอย่างที่ 2 (ไม่มีห้องนี้ → 404)
//   method: PUT    URL: http://localhost:3000/api/rooms/L-4242   body: Room ที่ถูกต้อง
// Postman ตัวอย่างที่ 3 (ข้อมูลผิด → 400)
//   method: PUT    URL: http://localhost:3000/api/rooms/L-1201   body (raw JSON): { "price": -5 }
// ---------------------------------------------------------------
router.put('/rooms/:id', requireLogin, async (req, res, next) => {
  try {
    // 1) ตรวจรหัสห้องและข้อมูล
    const roomId = req.params.id;
    if (!isRoomId(roomId)) {
      return sendBadRoomId(res, roomId);
    }
    let body = req.body;
    if (!isObject(body)) {
      body = {};
    }
    const errors = checkRoomBody(body, false);
    if (hasErrors(errors)) {
      return res.status(400).json({ error: { message: 'Please check the highlighted fields', fields: errors } });
    }
    const room = readRoomBody(body, roomId);

    // 2) อ่านค่าเดิม (ล็อกแถวไว้) -> แก้ -> เขียน Log ว่าเปลี่ยนอะไร
    const result = await runInTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM RoomUnit WHERE RoomID = ? FOR UPDATE', [roomId]);
      if (rows.length === 0) {
        return 'not-found';
      }
      const before = await addDetails(connection, rows[0]);
      await connection.execute(
        `UPDATE RoomUnit SET Building = ?, Floor = ?, RoomType = ?, NumberOfBedroom = ?, RoomSize = ?,
           Price = ?, RoomConditions = ?, ConditionRating = ?, MinimumLeases = ?, Availability = ?,
           OwnerName = ?, OwnerPhoneNumber = ?, OwnerEmail = ?, OwnerLineID = ?
         WHERE RoomID = ?`,
        roomValues(room).concat([roomId]),
      );
      await saveAppliances(connection, roomId, room.appliances);
      const changes = describeChanges(roomForLog(before), roomForLog(room));
      await writeLog(connection, req.admin.username, `UPDATE RoomUnit ${roomId}: ${changes}`);
      return 'updated';
    });
    if (result === 'not-found') {
      return res.status(404).json({ error: { message: `Room ${roomId} not found` } });
    }

    // 3) ส่งห้องหลังแก้กลับไป
    res.json({ data: await loadRoom(pool, roomId) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// DELETE /api/rooms/:id — ลบห้อง (ต้องล็อกอิน) เครื่องใช้และแถวรูปถูกลบตาม (FK CASCADE) แล้วลบไฟล์รูปด้วย
// ต้องล็อกอินก่อน (POST /api/auth/login) — Postman เก็บ cookie ให้เอง
// Postman ตัวอย่างที่ 1 (สำเร็จ → 200 { "data": { "ok": true } })
//   method: DELETE URL: http://localhost:3000/api/rooms/L-1999
// Postman ตัวอย่างที่ 2 (ไม่มีห้องนี้ → 404)
//   method: DELETE URL: http://localhost:3000/api/rooms/L-4242
// ---------------------------------------------------------------
router.delete('/rooms/:id', requireLogin, async (req, res, next) => {
  try {
    // 1) ตรวจรหัสห้อง
    const roomId = req.params.id;
    if (!isRoomId(roomId)) {
      return sendBadRoomId(res, roomId);
    }

    // 2) จำที่อยู่ไฟล์รูปไว้ก่อน แล้วลบห้อง + เขียน Log
    const filePaths = await runInTransaction(async (connection) => {
      const [imageRows] = await connection.execute('SELECT FilePath FROM RoomImage WHERE RoomID = ?', [roomId]);
      const [result] = await connection.execute('DELETE FROM RoomUnit WHERE RoomID = ?', [roomId]);
      if (result.affectedRows === 0) {
        return null; // ไม่มีห้องนี้
      }
      await writeLog(connection, req.admin.username, `DELETE RoomUnit ${roomId}`);
      const paths = [];
      for (const image of imageRows) {
        paths.push(image.FilePath);
      }
      return paths;
    });
    if (filePaths === null) {
      return res.status(404).json({ error: { message: `Room ${roomId} not found` } });
    }
    // ลบไฟล์ "หลัง" commit แล้วเท่านั้น (ถ้าลบใน DB ไม่สำเร็จ รูปจะยังอยู่ครบ)
    await deleteImageFiles(filePaths);

    // 3) ส่งกลับ
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
  UPLOAD_DIR,
  isRoomId,
  sendBadRoomId,
  loadRoom,
  deleteImageFiles,
};
