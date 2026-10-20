const {
  isPlainObject, isBlank, checkInt, checkString, checkEnum, checkEmail, collect,
} = require('./common');

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^\d{9,15}$/;

function checkIdentityNumber(raw) {
  if (isBlank(raw)) return { error: 'is required' };
  const text = String(raw).trim();
  if (!/^\d{13}$/.test(text)) return { error: 'must be exactly 13 digits' };
  return { value: text };
}

function checkPhone(raw) {
  const result = checkString(raw, 20);
  if (result.error) return result;
  if (!PHONE_PATTERN.test(result.value.replace(/[\s-]/g, ''))) {
    return { error: 'must be 9-15 digits (spaces and dashes allowed)' };
  }
  return result;
}

// `today` ('YYYY-MM-DD') is passed in so this stays a pure function.
function checkMoveInDate(raw, today) {
  if (isBlank(raw)) return { error: 'is required' };
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    return { error: 'must be a date in YYYY-MM-DD format' };
  }
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    return { error: 'must be a real calendar date' };
  }
  if (raw < today) return { error: 'must not be in the past' };
  return { value: raw };
}

function validateBooking(body, today) {
  const b = isPlainObject(body) ? body : {};
  return collect({
    roomId: checkInt(b.roomId, 1, 99999),
    fullName: checkString(b.fullName, 150),
    identityNumber: checkIdentityNumber(b.identityNumber),
    phone: checkPhone(b.phone),
    email: checkEmail(b.email),
    moveInDate: checkMoveInDate(b.moveInDate, today),
  });
}

function validateBookingStatus(body) {
  const b = isPlainObject(body) ? body : {};
  return collect({ status: checkEnum(b.status, BOOKING_STATUSES) });
}

/** Positive integer id from a URL segment, or null (caller answers 404). */
function parseBookingId(param) {
  const result = checkInt(param, 1, 2147483647);
  return result.error ? null : result.value;
}

module.exports = { validateBooking, validateBookingStatus, parseBookingId };
