const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { generate, cancel, status, getQrCode } = require('../controllers/einvoice.controller');

router.post('/:id/generate', authenticateToken, generate);
router.post('/:id/cancel', authenticateToken, cancel);
router.get('/:id/status', authenticateToken, status);
router.get('/:id/qrcode', authenticateToken, getQrCode);

module.exports = router;
