const {
  isPlainObject, isBlank, checkString, checkEnum, checkEmail, optional, collect,
} = require('./common');

const ROLES = ['super_admin', 'listing_admin', 'operations'];
const STATUSES = ['active', 'inactive'];
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;
const MAX_EMAILS = 5;

function checkUsername(raw) {
  const result = checkString(raw, 50);
  if (result.error) return result;
  if (!USERNAME_PATTERN.test(result.value)) {
    return { error: 'must be 3-50 letters, digits, dot, dash or underscore' };
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

function checkEmails(raw) {
  if (!Array.isArray(raw)) return { error: 'must be a list' };
  const emails = [];
  for (const item of raw) {
    const result = checkEmail(item);
    if (result.error) return { error: `${String(item)} ${result.error}` };
    const seen = emails.some((e) => e.toLowerCase() === result.value.toLowerCase());
    if (!seen) emails.push(result.value);
  }
  if (emails.length > MAX_EMAILS) return { error: `at most ${MAX_EMAILS} emails` };
  return { value: emails };
}

/** Create: username + password required. Update: no username, blank password = keep current. */
function validateAdmin(body, { isCreate }) {
  const b = isPlainObject(body) ? body : {};
  const rules = {
    firstName: checkString(b.firstName, 100),
    lastName: checkString(b.lastName, 100),
    address: optional(b.address, (v) => checkString(v, 255), null),
    role: checkEnum(b.role, ROLES),
    status: checkEnum(b.status, STATUSES),
    emails: optional(b.emails, checkEmails, []),
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
    status: optional(q.status, (v) => checkEnum(v, STATUSES), null),
  });
}

function validatePasswordReset(body) {
  const b = isPlainObject(body) ? body : {};
  return collect({ password: checkPassword(b.password) });
}

module.exports = { validateAdmin, validateAdminFilters, validatePasswordReset };
