const express = require('express');
const router = express.Router();
const { generate, cancel, webhook } = require('../controllers/paymentLink.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/webhook', webhook);
router.post('/:id/generate', authenticateToken, generate);
router.post('/:id/cancel', authenticateToken, cancel);

module.exports = router;
