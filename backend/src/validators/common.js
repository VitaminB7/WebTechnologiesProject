// Small pure checks shared by all validators. Each returns { value } or { error }.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBlank(raw) {
  return raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
}

// Accept real numbers and numeric strings (HTML forms and query strings send text).
function readNumber(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
  return NaN;
}

function checkInt(raw, min, max) {
  if (isBlank(raw)) return { error: 'is required' };
  const n = readNumber(raw);
  if (!Number.isInteger(n)) return { error: 'must be a whole number' };
  if (n < min || n > max) return { error: `must be between ${min} and ${max}` };
  return { value: n };
}

function checkNumber(raw, { min, max, greaterThan }) {
  if (isBlank(raw)) return { error: 'is required' };
  const n = readNumber(raw);
  if (!Number.isFinite(n)) return { error: 'must be a number' };
  if (greaterThan !== undefined && n <= greaterThan) return { error: `must be > ${greaterThan}` };
  if (min !== undefined && n < min) return { error: `must be >= ${min}` };
  if (n > max) return { error: `must be <= ${max}` };
  return { value: n };
}

function checkString(raw, maxLength) {
  if (isBlank(raw)) return { error: 'is required' };
  if (typeof raw !== 'string') return { error: 'must be text' };
  const text = raw.trim();
  if (text.length > maxLength) return { error: `must be at most ${maxLength} characters` };
  return { value: text };
}

function checkEnum(raw, allowed) {
  if (isBlank(raw)) return { error: 'is required' };
  if (!allowed.includes(raw)) return { error: `must be one of: ${allowed.join(', ')}` };
  return { value: raw };
}

function checkEmail(raw) {
  const result = checkString(raw, 100);
  if (result.error) return result;
  if (!EMAIL_PATTERN.test(result.value)) return { error: 'must be a valid email' };
  return result;
}

function checkBoolean(raw) {
  if (raw === true || raw === 'true') return { value: true };
  if (raw === false || raw === 'false') return { value: false };
  return { error: 'must be true or false' };
}

/** Blank input -> fallback; otherwise run the check. */
function optional(raw, check, fallback) {
  return isBlank(raw) ? { value: fallback } : check(raw);
}

/** Turn { key: { value } | { error } } into { value, errors } (errors is null when valid). */
function collect(results) {
  const value = {};
  const errors = {};
  for (const [key, result] of Object.entries(results)) {
    if (result.error) errors[key] = result.error;
    else value[key] = result.value;
  }
  if (Object.keys(errors).length > 0) return { value: null, errors };
  return { value, errors: null };
}

module.exports = {
  isPlainObject,
  isBlank,
  checkInt,
  checkNumber,
  checkString,
  checkEnum,
  checkEmail,
  checkBoolean,
  optional,
  collect,
};
