const express = require('express');
const router = express.Router();
const purchase = require('../controllers/purchase.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, purchase.list);
router.get('/:id', authenticateToken, purchase.get);
router.get('/:id/pdf', authenticateToken, purchase.downloadPDF);
router.post('/', authenticateToken, purchase.create);
router.put('/:id', authenticateToken, purchase.update);
router.patch('/:id/status', authenticateToken, purchase.updateStatus);
router.delete('/:id', authenticateToken, purchase.remove);

module.exports = router;
