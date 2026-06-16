const express = require('express');
const router = express.Router();
const supplier = require('../controllers/supplier.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, supplier.list);
router.get('/:id', authenticateToken, supplier.get);
router.post('/', authenticateToken, supplier.create);
router.put('/:id', authenticateToken, supplier.update);
router.patch('/:id/deactivate', authenticateToken, supplier.deactivate);
router.patch('/:id/activate', authenticateToken, supplier.activate);
router.delete('/:id', authenticateToken, supplier.remove);

module.exports = router;
