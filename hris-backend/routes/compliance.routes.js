const express = require('express');
const router = express.Router();
const { exportData, deleteTenantData } = require('../controllers/compliance.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/export', authenticateToken, exportData);
router.delete('/data', authenticateToken, deleteTenantData);

module.exports = router;
