const express = require('express');
const router = express.Router();
const { list, get, create, update, toggle, remove, generate } = require('../controllers/recurringInvoice.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, list);
router.get('/:id', authenticateToken, get);
router.post('/', authenticateToken, create);
router.put('/:id', authenticateToken, update);
router.patch('/:id/toggle', authenticateToken, toggle);
router.delete('/:id', authenticateToken, remove);
router.post('/:id/generate', authenticateToken, generate);

module.exports = router;
