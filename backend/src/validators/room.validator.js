const {
  isPlainObject, isBlank, checkInt, checkNumber, checkString, checkEnum, checkEmail,
  checkBoolean, optional, collect,
} = require('./common');

const ROOM_TYPES = ['Studio', '1 Bedroom', '2 Bedroom', 'Deluxe room'];
const SORTS = ['roomId', 'price_asc', 'price_desc'];
const MAX_PRICE = 999999.99;
const ROOM_ID_PATTERN = /^L-\d{4}$/;
const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/;
const OWNER_KEYS = ['name', 'phone', 'email', 'lineId'];

function checkRoomId(raw) {
  const result = checkString(raw, 8);
  if (result.error) return result;
  if (!ROOM_ID_PATTERN.test(result.value)) return { error: 'must be L- followed by 4 digits, e.g. L-1201' };
  return result;
}

function checkPhone(raw) {
  const result = checkString(raw, 20);
  if (result.error) return result;
  if (!PHONE_PATTERN.test(result.value)) return { error: 'must be in the format 000-000-0000' };
  return result;
}

/** Room id from the URL; null when it is not shaped like L-1234 (caller answers 400). */
function parseRoomId(param) {
  return ROOM_ID_PATTERN.test(param) ? param : null;
}

function checkApplianceItem(raw, index, seenSerials) {
  const item = isPlainObject(raw) ? raw : {};
  const serial = checkString(item.serialNumber, 50);
  const name = checkString(item.name, 100);
  const errors = {};
  // The DB compares serials case-insensitively, so "ac-1" and "AC-1" are the same appliance.
  const serialKey = serial.error ? null : serial.value.toLowerCase();
  if (serial.error) errors[`appliances.${index}.serialNumber`] = serial.error;
  else if (seenSerials.has(serialKey)) errors[`appliances.${index}.serialNumber`] = 'is used twice in this room';
  else seenSerials.add(serialKey);
  if (name.error) errors[`appliances.${index}.name`] = name.error;
  if (Object.keys(errors).length > 0) return { errors };
  return { value: { serialNumber: serial.value, name: name.value } };
}

/** Errors use the API's dot keys: appliances.0.serialNumber, appliances.0.name. */
function checkAppliances(raw) {
  if (isBlank(raw)) return { value: [], errors: {} };
  if (!Array.isArray(raw)) return { value: null, errors: { appliances: 'must be a list' } };
  const seenSerials = new Set();
  const value = [];
  let errors = {};
  raw.forEach((item, index) => {
    const result = checkApplianceItem(item, index, seenSerials);
    if (result.errors) errors = { ...errors, ...result.errors };
    else value.push(result.value);
  });
  return { value, errors };
}

function validateRoom(body) {
  const b = isPlainObject(body) ? body : {};
  const owner = isPlainObject(b.owner) ? b.owner : {};
  const fields = collect({
    roomId: checkRoomId(b.roomId),
    building: checkString(b.building, 100),
    roomType: checkEnum(b.roomType, ROOM_TYPES),
    bedrooms: checkInt(b.bedrooms, 0, 10),
    size: optional(b.size, (v) => checkNumber(v, { min: 1, max: 500 }), null),
    price: checkNumber(b.price, { min: 0, max: MAX_PRICE }),
    description: optional(b.description, (v) => checkString(v, 5000), null),
    minimumLease: optional(b.minimumLease, (v) => checkInt(v, 1, 36), null),
    available: checkBoolean(b.available),
    'owner.name': checkString(owner.name, 150),
    'owner.phone': checkPhone(owner.phone),
    'owner.email': optional(owner.email, checkEmail, null),
    'owner.lineId': optional(owner.lineId, (v) => checkString(v, 50), null),
  });
  const appliances = checkAppliances(b.appliances);
  const errors = { ...fields.errors, ...appliances.errors };
  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value: { ...nestOwner(fields.value), appliances: appliances.value }, errors: null };
}

// collect() works on flat keys; rebuild the nested owner object the API uses.
function nestOwner(flat) {
  const room = { ...flat, owner: {} };
  for (const key of OWNER_KEYS) {
    room.owner[key] = flat[`owner.${key}`];
    delete room[`owner.${key}`];
  }
  return room;
}

function validateRoomSearch(query) {
  const q = isPlainObject(query) ? query : {};
  const { value, errors } = collect({
    type: optional(q.type, (v) => checkEnum(v, ROOM_TYPES), null),
    minPrice: optional(q.minPrice, (v) => checkNumber(v, { min: 0, max: MAX_PRICE }), null),
    maxPrice: optional(q.maxPrice, (v) => checkNumber(v, { min: 0, max: MAX_PRICE }), null),
    bedrooms: optional(q.bedrooms, (v) => checkInt(v, 0, 10), null),
    available: optional(q.available, checkBoolean, null),
    q: optional(q.q, (v) => checkString(v, 100), null),
    page: optional(q.page, (v) => checkInt(v, 1, 100000), 1),
    pageSize: optional(q.pageSize, (v) => checkInt(v, 1, 50), 12),
    sort: optional(q.sort, (v) => checkEnum(v, SORTS), 'roomId'),
  });
  if (errors) return { value: null, errors };
  if (value.minPrice !== null && value.maxPrice !== null && value.minPrice > value.maxPrice) {
    return { value: null, errors: { maxPrice: 'must be >= minPrice' } };
  }
  return { value, errors: null };
}

module.exports = { validateRoom, validateRoomSearch, parseRoomId };
