const HttpError = require('../utils/http-error');
const { parseRoomId } = require('../validators/room.validator');

/** Check :id once for every /rooms/:id route; anything not shaped like L-1234 is a bad request. */
function requireRoomId(req, res, next) {
  const roomId = parseRoomId(req.params.id);
  if (roomId === null) {
    return next(new HttpError(400, `Invalid room id ${req.params.id}`, { roomId: 'must be L- followed by 4 digits' }));
  }
  req.roomId = roomId;
  return next();
}

module.exports = requireRoomId;
