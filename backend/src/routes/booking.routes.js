const express = require('express');
const controller = require('../controllers/booking.controller');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/bookings', asyncHandler(controller.create));
router.get('/bookings', requireAuth, asyncHandler(controller.list));
router.patch('/bookings/:id', requireAuth, asyncHandler(controller.updateStatus));

module.exports = router;
