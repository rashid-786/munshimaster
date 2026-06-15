const express = require('express');
const router = express.Router();
const { getTenantSettings, updateTenantSettings } = require('../controllers/tenant.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/settings', authenticateToken, getTenantSettings);
router.put('/settings', authenticateToken, updateTenantSettings);

module.exports = router;
