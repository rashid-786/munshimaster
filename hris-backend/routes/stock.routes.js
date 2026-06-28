const express = require('express');
const router = express.Router();
const stock = require('../controllers/stock.controller');
const { authenticateToken } = require('../middleware/auth');

// Stock movements (standalone endpoints, not nested under products)
router.get('/movements', authenticateToken, stock.listMovements);
router.post('/movements', authenticateToken, stock.recordMovement);
router.get('/alerts', authenticateToken, stock.getLowStockAlerts);
router.get('/summary', authenticateToken, stock.getStockSummary);

module.exports = router;
