const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const { importPreview, importConfirm, listTransactions, listImports, categorize, match } = require('../controllers/bank.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/import/preview', authenticateToken, upload.single('file'), importPreview);
router.post('/import/confirm', authenticateToken, importConfirm);
router.get('/transactions', authenticateToken, listTransactions);
router.get('/imports', authenticateToken, listImports);
router.patch('/transactions/:id/categorize', authenticateToken, categorize);
router.patch('/transactions/:id/match', authenticateToken, match);

module.exports = router;
