const express = require('express');
const multer = require('multer');
const router = express.Router();
const { previewImport, executeImport, downloadTemplate } = require('../controllers/import.controller');
const { authenticateToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/preview', authenticateToken, upload.single('file'), previewImport);
router.post('/execute', authenticateToken, executeImport);
router.get('/template', authenticateToken, downloadTemplate);

module.exports = router;
