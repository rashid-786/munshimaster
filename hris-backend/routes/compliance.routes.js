const express = require('express');
const router = express.Router();
const { exportData, deleteTenantData } = require('../controllers/compliance.controller');
const { authenticateToken } = require('../middleware/auth');
const { planGate } = require('../middleware/planGate');

// Backup download is a paid-plan feature (Manage and above).
router.get('/export', authenticateToken, planGate(1), exportData);
router.delete('/data', authenticateToken, deleteTenantData);

module.exports = router;
