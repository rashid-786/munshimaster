const express = require('express');
const router = express.Router();
const { getTenantSettings, updateTenantSettings } = require('../controllers/tenant.controller');
const { getTenantSections } = require('../controllers/sectionVisibility.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/settings', authenticateToken, getTenantSettings);
router.put('/settings', authenticateToken, updateTenantSettings);
router.get('/sections', authenticateToken, getTenantSections);

module.exports = router;
