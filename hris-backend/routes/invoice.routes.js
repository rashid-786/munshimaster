const express = require('express');
const router = express.Router();
const invoice = require('../controllers/invoice.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, invoice.list);
router.get('/:id', authenticateToken, invoice.get);
router.get('/:id/pdf', authenticateToken, invoice.downloadPDF);
router.post('/', authenticateToken, invoice.create);
router.put('/:id', authenticateToken, invoice.update);
router.patch('/:id/status', authenticateToken, invoice.updateStatus);
router.delete('/:id', authenticateToken, invoice.remove);

module.exports = router;
