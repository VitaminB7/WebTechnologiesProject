const express = require('express');
const controller = require('../controllers/auth.controller');
const asyncHandler = require('../utils/async-handler');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/auth/login', asyncHandler(controller.login));
router.post('/auth/logout', asyncHandler(controller.logout));
router.get('/auth/me', requireAuth, controller.me);

module.exports = router;
