const {
  isPlainObject, checkInt, checkNumber, checkString, checkEnum, checkEmail,
  checkBoolean, optional, collect,
} = require('./common');

const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite'];
const APPLIANCES = [
  'Sofa', 'Water heater', 'Fridge', 'TV', 'HomePhone',
  'Air conditioner', 'Heater', 'Washing machine', 'Microwave', 'Induction stove',
];
const SORTS = ['roomId', 'price_asc', 'price_desc', 'newest'];
const DEFAULT_BUILDING = 'AURA Sukhumvit 36';
const MAX_PRICE = 99999999.99;
const OWNER_KEYS = ['name', 'phone', 'email', 'lineId'];

function checkAppliances(raw) {
  if (!Array.isArray(raw)) return { error: 'must be a list' };
  const unknown = raw.filter((item) => !APPLIANCES.includes(item));
  if (unknown.length > 0) return { error: `unknown appliance: ${unknown.join(', ')}` };
  return { value: [...new Set(raw)] };
}

/** Room number from the URL; null when it cannot be a room (caller answers 404). */
function parseRoomId(param) {
  const result = checkInt(param, 1, 99999);
  return result.error ? null : result.value;
}

/** Image id from the URL; null when it cannot be an id (caller answers 404). */
function parseImageId(param) {
  const result = checkInt(param, 1, 2147483647);
  return result.error ? null : result.value;
}

function validateRoom(body) {
  const b = isPlainObject(body) ? body : {};
  const owner = isPlainObject(b.owner) ? b.owner : {};
  const { value, errors } = collect({
    roomId: checkInt(b.roomId, 1, 99999),
    building: optional(b.building, (v) => checkString(v, 100), DEFAULT_BUILDING),
    floor: checkInt(b.floor, 1, 99),
    roomType: checkEnum(b.roomType, ROOM_TYPES),
    bedrooms: checkInt(b.bedrooms, 0, 10),
    size: checkNumber(b.size, { greaterThan: 0, max: 9999.99 }),
    price: checkNumber(b.price, { min: 0, max: MAX_PRICE }),
    description: optional(b.description, (v) => checkString(v, 5000), null),
    conditionRating: checkInt(b.conditionRating, 1, 5),
    minimumLease: checkInt(b.minimumLease, 1, 120),
    available: optional(b.available, checkBoolean, true),
    appliances: optional(b.appliances, checkAppliances, []),
    'owner.name': checkString(owner.name, 150),
    'owner.phone': optional(owner.phone, (v) => checkString(v, 20), null),
    'owner.email': optional(owner.email, checkEmail, null),
    'owner.lineId': optional(owner.lineId, (v) => checkString(v, 50), null),
  });
  if (errors) return { value: null, errors };
  return { value: nestOwner(value), errors: null };
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
    floor: optional(q.floor, (v) => checkInt(v, 1, 99), null),
    minPrice: optional(q.minPrice, (v) => checkNumber(v, { min: 0, max: MAX_PRICE }), null),
    maxPrice: optional(q.maxPrice, (v) => checkNumber(v, { min: 0, max: MAX_PRICE }), null),
    bedrooms: optional(q.bedrooms, (v) => checkInt(v, 0, 10), null),
    minCondition: optional(q.minCondition, (v) => checkInt(v, 1, 5), null),
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

module.exports = { validateRoom, validateRoomSearch, parseRoomId, parseImageId };
