const {
  isPlainObject, isBlank, checkString, checkEnum, checkEmail, optional, collect,
} = require('./common');

const ROLES = ['Admin', 'SuperAdmin'];
const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,50}$/;

function checkUsername(raw) {
  const result = checkString(raw, 50);
  if (result.error) return result;
  if (!USERNAME_PATTERN.test(result.value)) {
    return { error: 'must be 3-50 letters, digits, dot or underscore' };
  }
  return result;
}

// bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
function checkPassword(raw) {
  if (isBlank(raw)) return { error: 'is required' };
  if (typeof raw !== 'string') return { error: 'must be text' };
  if (raw.length < 8) return { error: 'must be at least 8 characters' };
  if (Buffer.byteLength(raw, 'utf8') > 72) return { error: 'must be at most 72 bytes' };
  return { value: raw };
}

/** Create: username + password required. Update: no username, blank password = keep current. */
function validateAdmin(body, { isCreate }) {
  const b = isPlainObject(body) ? body : {};
  const rules = {
    firstName: checkString(b.firstName, 100),
    lastName: checkString(b.lastName, 100),
    address: optional(b.address, (v) => checkString(v, 255), null),
    role: checkEnum(b.role, ROLES),
    email: optional(b.email, checkEmail, null),
    password: isCreate ? checkPassword(b.password) : optional(b.password, checkPassword, null),
  };
  if (isCreate) rules.username = checkUsername(b.username);
  return collect(rules);
}

function validateAdminFilters(query) {
  const q = isPlainObject(query) ? query : {};
  return collect({
    q: optional(q.q, (v) => checkString(v, 100), null),
    role: optional(q.role, (v) => checkEnum(v, ROLES), null),
  });
}

function validatePasswordReset(body) {
  const b = isPlainObject(body) ? body : {};
  return collect({ password: checkPassword(b.password) });
}

module.exports = { validateAdmin, validateAdminFilters, validatePasswordReset };
