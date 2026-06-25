const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditActions, getAuditDetail } = require('../controllers/audit.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getAuditLogs);
router.get('/actions', authenticateToken, getAuditActions);
router.get('/:id', authenticateToken, getAuditDetail);

module.exports = router;
