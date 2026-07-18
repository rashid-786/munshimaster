const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const ctrl = require('../controllers/invoiceTemplate.controller');
const tplCtrl = require('../controllers/tenantTemplate.controller');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp) are allowed.'));
  },
});

// Legacy single-template endpoints (backward compatible)
router.get('/', authenticateToken, ctrl.getTemplates);
router.get('/default', authenticateToken, ctrl.getDefaultSettings);
router.put('/settings', authenticateToken, ctrl.updateSettings);
router.post('/logo', authenticateToken, upload.single('logo'), ctrl.uploadLogo);
router.post('/signature', authenticateToken, upload.single('signature'), ctrl.uploadSignature);
router.delete('/signature', authenticateToken, ctrl.removeSignature);

// ========== Phase 4: Multi-template engine ==========

// Document types & merge tags
router.get('/document-types', authenticateToken, tplCtrl.getDocumentTypes);
router.get('/merge-tags', authenticateToken, tplCtrl.getMergeTags);

// Tenant template CRUD
router.get('/tenant', authenticateToken, tplCtrl.listTemplates);
router.get('/tenant/:id', authenticateToken, tplCtrl.getTemplate);
router.post('/tenant', authenticateToken, tplCtrl.createTemplate);
router.put('/tenant/:id', authenticateToken, tplCtrl.updateTemplate);
router.delete('/tenant/:id', authenticateToken, tplCtrl.deleteTemplate);
router.post('/tenant/:id/clone', authenticateToken, tplCtrl.cloneTemplate);
router.put('/tenant/:id/default', authenticateToken, tplCtrl.setDefaultTemplate);

// Marketplace
router.get('/marketplace', authenticateToken, tplCtrl.listMarketplaceTemplates);
router.get('/marketplace/:id', authenticateToken, tplCtrl.getMarketplaceTemplateDetail);
router.post('/marketplace/:id/activate', authenticateToken, tplCtrl.activateMarketplaceTemplate);

// Resolve template for document type
router.get('/resolve/:document_type', authenticateToken, tplCtrl.resolveTemplateForDocument);

module.exports = router;
