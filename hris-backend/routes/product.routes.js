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

// Party-specific pricing
router.get('/:productId/party-prices', authenticateToken, product.listPartyPrices);
router.post('/:productId/party-prices', authenticateToken, product.createPartyPrice);
router.put('/party-prices/:id', authenticateToken, product.updatePartyPrice);
router.delete('/party-prices/:id', authenticateToken, product.deletePartyPrice);

module.exports = router;
