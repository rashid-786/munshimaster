const express = require('express');
const router = express.Router();
const product = require('../controllers/product.controller');
const stock = require('../controllers/stock.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, product.list);
router.get('/:id', authenticateToken, product.get);
router.post('/', authenticateToken, product.create);
router.put('/:id', authenticateToken, product.update);
router.delete('/:id', authenticateToken, product.remove);

// Bulk
router.post('/bulk/delete', authenticateToken, product.bulkDelete);

// Stock movements
router.get('/:id/movements', authenticateToken, stock.listMovements);

module.exports = router;
