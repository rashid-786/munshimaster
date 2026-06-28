const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { list, getOne, create, updateStatus, delete: del } = require('../controllers/note.controller');

router.get('/:type', authenticateToken, list);
router.get('/:type/:id', authenticateToken, getOne);
router.post('/:type', authenticateToken, create);
router.patch('/:type/:id/status', authenticateToken, updateStatus);
router.delete('/:type/:id', authenticateToken, del);

module.exports = router;
