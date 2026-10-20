const roomService = require('../services/room.service');
const roomImageService = require('../services/room-image.service');
const assertValid = require('../utils/assert-valid');
const HttpError = require('../utils/http-error');
const { validateRoom, validateRoomSearch, parseImageId } = require('../validators/room.validator');

// req.roomId is set by the requireRoomId middleware on every /rooms/:id route.

async function list(req, res) {
  const filters = assertValid(validateRoomSearch(req.query));
  const { rooms, meta } = await roomService.searchRooms(filters);
  res.json({ data: rooms, meta });
}

async function getOne(req, res) {
  res.json({ data: await roomService.getRoom(req.roomId) });
}

async function similar(req, res) {
  res.json({ data: await roomService.getSimilarRooms(req.roomId) });
}

async function stats(req, res) {
  res.json({ data: await roomService.getStats() });
}

async function create(req, res) {
  const room = assertValid(validateRoom(req.body));
  res.status(201).json({ data: await roomService.createRoom(room, req.admin.username) });
}

async function update(req, res) {
  // roomId in the body is ignored: the URL decides which room is updated.
  const room = assertValid(validateRoom({ ...req.body, roomId: req.roomId }));
  res.json({ data: await roomService.updateRoom(req.roomId, room, req.admin.username) });
}

async function remove(req, res) {
  await roomService.deleteRoom(req.roomId, req.admin.username);
  res.json({ data: { ok: true } });
}

async function addImages(req, res) {
  res.json({ data: await roomImageService.addImages(req.roomId, req.files, req.admin.username) });
}

async function removeImage(req, res) {
  const imageId = parseImageId(req.params.imageId);
  if (imageId === null) throw new HttpError(404, 'Image not found');
  const room = await roomImageService.removeImage(req.roomId, imageId, req.admin.username);
  res.json({ data: room });
}

module.exports = { list, getOne, similar, stats, create, update, remove, addImages, removeImage };
