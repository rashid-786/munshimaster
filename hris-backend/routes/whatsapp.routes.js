const express = require('express');
const router = express.Router();
const { sendInvoice, sendPurchaseOrder, sendPaymentReminder, getLogs, getSettings } = require('../controllers/whatsapp.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/settings', authenticateToken, getSettings);
router.get('/logs', authenticateToken, getLogs);
router.post('/send/invoice/:id', authenticateToken, sendInvoice);
router.post('/send/purchase-order/:id', authenticateToken, sendPurchaseOrder);
router.post('/send/payment-reminder/:id', authenticateToken, sendPaymentReminder);

module.exports = router;
