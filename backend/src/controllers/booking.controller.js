const bookingService = require('../services/booking.service');
const assertValid = require('../utils/assert-valid');
const HttpError = require('../utils/http-error');
const { todayInBangkok } = require('../utils/dates');
const {
  validateBooking, validateBookingStatus, parseBookingId,
} = require('../validators/booking.validator');

async function create(req, res) {
  const input = assertValid(validateBooking(req.body, todayInBangkok()));
  res.status(201).json({ data: await bookingService.createBooking(input) });
}

async function list(req, res) {
  res.json({ data: await bookingService.listBookings() });
}

async function updateStatus(req, res) {
  const bookingId = parseBookingId(req.params.id);
  if (bookingId === null) throw new HttpError(404, `Booking ${req.params.id} not found`);
  const { status } = assertValid(validateBookingStatus(req.body));
  res.json({ data: await bookingService.updateBookingStatus(bookingId, status, req.admin.username) });
}

module.exports = { create, list, updateStatus };
