const express = require('express');
const router = express.Router();
const publicRouter = express.Router();
const legalController = require('../controllers/legalDocument.controller');
const { authenticateToken } = require('../middleware/auth');

// ─── Tenant-facing (mounted under /api/v1/core/legal) ─────────
router.get('/', authenticateToken, legalController.listTenantDocuments);
router.get('/:slug', authenticateToken, legalController.getTenantDocument);
router.post('/:id/accept', authenticateToken, legalController.acceptDocument);

// ─── Public compliance URLs (mounted under /api/v1/public/legal)
publicRouter.get('/:slug/json', legalController.getPublicDocument);
publicRouter.get('/:slug', legalController.getPublicDocumentHtml);

module.exports = { router, publicRouter };