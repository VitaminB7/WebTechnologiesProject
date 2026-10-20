const express = require('express');
const authRoutes = require('./auth.routes');
const roomRoutes = require('./room.routes');
const adminRoutes = require('./admin.routes');
const logRoutes = require('./log.routes');
const { apiNotFound } = require('../middleware/error-handler');

const router = express.Router();

router.use(authRoutes);
router.use(roomRoutes);
router.use(adminRoutes);
router.use(logRoutes);
router.use(apiNotFound);

module.exports = router;
