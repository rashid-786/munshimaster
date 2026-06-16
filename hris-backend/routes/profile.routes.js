const express = require('express');
const router = express.Router();
const { changePassword, updateProfile } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/change-password', authenticateToken, changePassword);
router.put('/', authenticateToken, updateProfile);

module.exports = router;
