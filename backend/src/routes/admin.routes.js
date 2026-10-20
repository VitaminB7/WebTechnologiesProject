const express = require('express');
const controller = require('../controllers/admin.controller');
const asyncHandler = require('../utils/async-handler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use('/admins', requireAuth, requireRole('SuperAdmin'));

router.get('/admins', asyncHandler(controller.list));
router.get('/admins/:username', asyncHandler(controller.getOne));
router.post('/admins', asyncHandler(controller.create));
router.put('/admins/:username', asyncHandler(controller.update));
router.delete('/admins/:username', asyncHandler(controller.remove));
router.post('/admins/:username/reset-password', asyncHandler(controller.resetPassword));

module.exports = router;
