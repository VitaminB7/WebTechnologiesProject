const express = require('express');
const controller = require('../controllers/room.controller');
const asyncHandler = require('../utils/async-handler');
const requireRoomId = require('../middleware/room-id');
const { requireAuth } = require('../middleware/auth');
const { uploadRoomImages } = require('../middleware/upload');

const router = express.Router();

router.get('/stats', asyncHandler(controller.stats));

router.get('/rooms', asyncHandler(controller.list));
router.get('/rooms/:id', requireRoomId, asyncHandler(controller.getOne));
router.get('/rooms/:id/similar', requireRoomId, asyncHandler(controller.similar));

router.post('/rooms', requireAuth, asyncHandler(controller.create));
router.put('/rooms/:id', requireAuth, requireRoomId, asyncHandler(controller.update));
router.delete('/rooms/:id', requireAuth, requireRoomId, asyncHandler(controller.remove));
router.post('/rooms/:id/images', requireAuth, requireRoomId, uploadRoomImages, asyncHandler(controller.addImages));
router.delete('/rooms/:id/images/:imageId', requireAuth, requireRoomId, asyncHandler(controller.removeImage));

module.exports = router;
