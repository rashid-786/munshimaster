const express = require('express');
const router = express.Router();
const customer = require('../controllers/customer.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, customer.list);
router.get('/:id', authenticateToken, customer.get);
router.post('/', authenticateToken, customer.create);
router.put('/:id', authenticateToken, customer.update);
router.patch('/:id/deactivate', authenticateToken, customer.deactivate);
router.patch('/:id/activate', authenticateToken, customer.activate);
router.delete('/:id', authenticateToken, customer.remove);

module.exports = router;
