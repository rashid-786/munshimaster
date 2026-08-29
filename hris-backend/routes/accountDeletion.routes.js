const express = require('express');
const router = express.Router();
const accountDeletionController = require('../controllers/accountDeletion.controller');
const { authenticateToken } = require('../middleware/auth');

// Tenant-facing account deletion requests (mounted under /api/v1/core/account-deletion)
router.post('/request', authenticateToken, accountDeletionController.requestDeletion);
router.get('/request', authenticateToken, accountDeletionController.getMyRequest);
router.delete('/request', authenticateToken, accountDeletionController.cancelMyRequest);

module.exports = router;