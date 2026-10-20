const HttpError = require('../utils/http-error');

function sendError(res, status, message, fields) {
  const error = { message };
  if (fields && Object.keys(fields).length > 0) error.fields = fields;
  res.status(status).json({ error });
}

/** Unknown /api/* paths answer in the API error shape instead of Express's HTML page. */
function apiNotFound(req, res) {
  sendError(res, 404, `No API route for ${req.method} ${req.originalUrl.split('?')[0]}`);
}

// Express recognises an error handler by its four parameters, so `next` must stay.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return sendError(res, err.status, err.message, err.fields);
  }
  // body-parser errors (bad JSON, body too large) are safe client errors.
  if (err.expose && err.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'Request body is not valid JSON' : err.message;
    return sendError(res, err.status, message);
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 409, 'This record already exists');
  }
  console.error(err);
  return sendError(res, 500, 'Something went wrong on the server');
}

module.exports = { errorHandler, apiNotFound };
