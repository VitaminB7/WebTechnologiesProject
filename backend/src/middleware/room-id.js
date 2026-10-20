const HttpError = require('../utils/http-error');
const { parseRoomId } = require('../validators/room.validator');

/**
 * Parse :id once for every /rooms/:id route (and before multer writes any file).
 * Anything that cannot be a room number is simply "not found".
 */
function requireRoomId(req, res, next) {
  const roomId = parseRoomId(req.params.id);
  if (roomId === null) return next(new HttpError(404, `Room ${req.params.id} not found`));
  req.roomId = roomId;
  return next();
}

module.exports = requireRoomId;
