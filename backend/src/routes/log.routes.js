const express = require('express');
const controller = require('../controllers/log.controller');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/logs', requireAuth, requireRole('super_admin'), asyncHandler(controller.list));

module.exports = router;
