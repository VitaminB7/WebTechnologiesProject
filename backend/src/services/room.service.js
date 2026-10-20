const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const withTransaction = require('../utils/transaction');
const { toRoom, toRoomImage } = require('../utils/mappers');
const { logAction, describeChanges } = require('../utils/log-action');
const { isDuplicateKey, placeholders, escapeLike } = require('../utils/sql-helpers');
const { removeUploadedFiles } = require('../utils/files');

// Whitelisted ORDER BY clauses; the user only ever picks a key, never SQL text.
const SORT_SQL = {
  roomId: 'RoomID ASC',
  price_asc: 'Price ASC, RoomID ASC',
  price_desc: 'Price DESC, RoomID ASC',
  newest: 'CreatedAt DESC, RoomID DESC',
};

const ROOM_COLUMNS_SQL = `Building = ?, Floor = ?, RoomType = ?, NumberOfBedroom = ?, RoomSize = ?,
  Price = ?, RoomConditions = ?, ConditionRating = ?, MinimumLeases = ?, Availability = ?,
  OwnerName = ?, OwnerPhoneNumber = ?, OwnerEmail = ?, OwnerLineID = ?`;

function roomColumnValues(room) {
  return [
    room.building, room.floor, room.roomType, room.bedrooms, room.size,
    room.price, room.description, room.conditionRating, room.minimumLease, room.available ? 1 : 0,
    room.owner.name, room.owner.phone, room.owner.email, room.owner.lineId,
  ];
}

function notFound(roomId) {
  return new HttpError(404, `Room ${roomId} not found`);
}

/** Load appliances and images for many rooms with two queries, then map to API objects. */
async function attachDetails(db, rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.RoomID);
  const inList = placeholders(ids.length);
  const [applianceRows] = await db.execute(
    `SELECT RoomID, Appliance FROM RoomAppliance WHERE RoomID IN (${inList}) ORDER BY Appliance`, ids,
  );
  const [imageRows] = await db.execute(
    `SELECT RoomID, ImageID, FilePath FROM RoomImage WHERE RoomID IN (${inList}) ORDER BY SortOrder, ImageID`, ids,
  );
  const rowsOf = (list, id) => list.filter((r) => r.RoomID === id);
  const appliancesOf = (id) => rowsOf(applianceRows, id).map((r) => r.Appliance);
  const imagesOf = (id) => rowsOf(imageRows, id).map(toRoomImage);
  return rows.map((row) => toRoom(row, appliancesOf(row.RoomID), imagesOf(row.RoomID)));
}

async function findRoomRow(db, roomId, { lock = false } = {}) {
  const sql = `SELECT * FROM RoomUnit WHERE RoomID = ?${lock ? ' FOR UPDATE' : ''}`;
  const [rows] = await db.execute(sql, [roomId]);
  return rows[0] || null;
}

async function getRoom(roomId, db = pool) {
  const row = await findRoomRow(db, roomId);
  if (!row) throw notFound(roomId);
  const [room] = await attachDetails(db, [row]);
  return room;
}

function buildSearchWhere(filters) {
  const clauses = [];
  const params = [];
  const add = (clause, ...values) => { clauses.push(clause); params.push(...values); };
  if (filters.type !== null) add('RoomType = ?', filters.type);
  if (filters.floor !== null) add('Floor = ?', filters.floor);
  if (filters.minPrice !== null) add('Price >= ?', filters.minPrice);
  if (filters.maxPrice !== null) add('Price <= ?', filters.maxPrice);
  if (filters.bedrooms !== null) add('NumberOfBedroom = ?', filters.bedrooms);
  if (filters.minCondition !== null) add('ConditionRating >= ?', filters.minCondition);
  if (filters.available !== null) add('Availability = ?', filters.available ? 1 : 0);
  if (filters.q !== null) {
    const like = `%${escapeLike(filters.q)}%`;
    add('(CAST(RoomID AS CHAR) LIKE ? OR OwnerName LIKE ?)', like, like);
  }
  return { where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function searchRooms(filters) {
  const { where, params } = buildSearchWhere(filters);
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM RoomUnit ${where}`, params);
  const offset = (filters.page - 1) * filters.pageSize;
  // MySQL 8 prepared statements need LIMIT/OFFSET values sent as strings.
  const [rows] = await pool.execute(
    `SELECT * FROM RoomUnit ${where} ORDER BY ${SORT_SQL[filters.sort]} LIMIT ? OFFSET ?`,
    [...params, String(filters.pageSize), String(offset)],
  );
  const rooms = await attachDetails(pool, rows);
  return { rooms, meta: { page: filters.page, pageSize: filters.pageSize, total } };
}

async function getSimilarRooms(roomId) {
  const row = await findRoomRow(pool, roomId);
  if (!row) throw notFound(roomId);
  const [rows] = await pool.execute(
    `SELECT * FROM RoomUnit WHERE RoomType = ? AND RoomID <> ?
     ORDER BY Availability DESC, ABS(Price - ?), RoomID LIMIT 3`,
    [row.RoomType, roomId, row.Price],
  );
  return attachDetails(pool, rows);
}

async function getStats() {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS totalRooms, COUNT(DISTINCT RoomType) AS roomTypes,
            COALESCE(SUM(Availability), 0) AS availableRooms
     FROM RoomUnit`,
  );
  return {
    totalRooms: Number(row.totalRooms),
    roomTypes: Number(row.roomTypes),
    availableRooms: Number(row.availableRooms),
  };
}

async function replaceAppliances(db, roomId, appliances) {
  await db.execute('DELETE FROM RoomAppliance WHERE RoomID = ?', [roomId]);
  for (const appliance of appliances) {
    await db.execute('INSERT INTO RoomAppliance (RoomID, Appliance) VALUES (?, ?)', [roomId, appliance]);
  }
}

async function createRoom(room, actor) {
  await withTransaction(async (db) => {
    try {
      await db.execute(
        `INSERT INTO RoomUnit SET RoomID = ?, ${ROOM_COLUMNS_SQL}`,
        [room.roomId, ...roomColumnValues(room)],
      );
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new HttpError(409, `Room ${room.roomId} already exists`, { roomId: 'already exists' });
      }
      throw err;
    }
    await replaceAppliances(db, room.roomId, room.appliances);
    await logAction(db, actor, `CREATE RoomUnit ${room.roomId}`);
  });
  return getRoom(room.roomId);
}

// Flat view of the editable fields, used only to describe changes in the Log.
function loggableFields(room) {
  const { roomId, images, updatedAt, owner, appliances, ...rest } = room;
  return {
    ...rest,
    appliances: [...appliances].sort(),
    ownerName: owner.name,
    ownerPhone: owner.phone,
    ownerEmail: owner.email,
    ownerLineId: owner.lineId,
  };
}

async function updateRoom(roomId, room, actor) {
  await withTransaction(async (db) => {
    const row = await findRoomRow(db, roomId, { lock: true });
    if (!row) throw notFound(roomId);
    const [before] = await attachDetails(db, [row]);
    await db.execute(
      `UPDATE RoomUnit SET ${ROOM_COLUMNS_SQL}, UpdatedAt = CURRENT_TIMESTAMP WHERE RoomID = ?`,
      [...roomColumnValues(room), roomId],
    );
    await replaceAppliances(db, roomId, room.appliances);
    const changes = describeChanges(loggableFields(before), loggableFields({ ...room, roomId }));
    await logAction(db, actor, `UPDATE RoomUnit ${roomId}: ${changes || 'no changes'}`);
  });
  return getRoom(roomId);
}

async function deleteRoom(roomId, actor) {
  const imagePaths = await withTransaction(async (db) => {
    const row = await findRoomRow(db, roomId, { lock: true });
    if (!row) throw notFound(roomId);
    const [images] = await db.execute('SELECT FilePath FROM RoomImage WHERE RoomID = ?', [roomId]);
    await db.execute('DELETE FROM RoomUnit WHERE RoomID = ?', [roomId]);
    await logAction(db, actor, `DELETE RoomUnit ${roomId}`);
    return images.map((image) => image.FilePath);
  });
  // Files are removed only after the commit, so a failed delete never loses images.
  await removeUploadedFiles(imagePaths);
}

module.exports = {
  getRoom,
  findRoomRow,
  searchRooms,
  getSimilarRooms,
  getStats,
  createRoom,
  updateRoom,
  deleteRoom,
  notFound,
};
