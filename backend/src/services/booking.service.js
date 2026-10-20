const pool = require('../config/db');
const HttpError = require('../utils/http-error');
const withTransaction = require('../utils/transaction');
const { toBooking } = require('../utils/mappers');
const { logAction } = require('../utils/log-action');
const { findRoomRow } = require('./room.service');

async function findBooking(db, bookingId, { lock = false } = {}) {
  const [rows] = await db.execute(
    `SELECT * FROM Booking WHERE BookingID = ?${lock ? ' FOR UPDATE' : ''}`, [bookingId],
  );
  return rows[0] || null;
}

/** Public booking request; the room is locked so it cannot change availability mid-insert. */
async function createBooking(input) {
  const bookingId = await withTransaction(async (db) => {
    const room = await findRoomRow(db, input.roomId, { lock: true });
    if (!room) throw new HttpError(400, 'Room does not exist', { roomId: 'room not found' });
    if (!room.Availability) {
      throw new HttpError(400, 'This room is not available', { roomId: 'room is not available' });
    }
    const [result] = await db.execute(
      `INSERT INTO Booking (RoomID, FullName, IdentityNumber, Phone, Email, MoveInDate)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.roomId, input.fullName, input.identityNumber, input.phone, input.email, input.moveInDate],
    );
    await logAction(db, null, `CREATE Booking ${result.insertId} for RoomUnit ${input.roomId}`);
    return result.insertId;
  });
  return toBooking(await findBooking(pool, bookingId));
}

async function listBookings() {
  const [rows] = await pool.execute('SELECT * FROM Booking ORDER BY CreatedAt DESC, BookingID DESC');
  return rows.map(toBooking);
}

async function updateBookingStatus(bookingId, status, actor) {
  await withTransaction(async (db) => {
    const booking = await findBooking(db, bookingId, { lock: true });
    if (!booking) throw new HttpError(404, `Booking ${bookingId} not found`);
    await db.execute('UPDATE Booking SET Status = ? WHERE BookingID = ?', [status, bookingId]);
    await logAction(db, actor, `UPDATE Booking ${bookingId}: status ${booking.Status} -> ${status}`);
  });
  return toBooking(await findBooking(pool, bookingId));
}

module.exports = { createBooking, listBookings, updateBookingStatus };
