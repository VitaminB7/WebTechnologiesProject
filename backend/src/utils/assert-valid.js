const HttpError = require('./http-error');

/** Unwrap a validator result: return the clean value or throw 400 with per-field messages. */
function assertValid({ value, errors }) {
  if (errors) throw new HttpError(400, 'Please check the highlighted fields', errors);
  return value;
}

module.exports = assertValid;
