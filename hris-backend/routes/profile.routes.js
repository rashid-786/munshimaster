const express = require('express');
const router = express.Router();
const { changePassword, updateProfile, getProfileStatus, completeProfile } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/change-password', authenticateToken, changePassword);
router.put('/', authenticateToken, updateProfile);
router.get('/status', authenticateToken, getProfileStatus);
router.post('/complete', authenticateToken, completeProfile);

module.exports = router;
