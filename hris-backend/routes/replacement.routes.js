const express = require('express');
const router = express.Router();
const { getReplacements, createReplacement, endReplacement, deleteReplacement } = require('../controllers/replacement.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getReplacements);
router.post('/', authenticateToken, createReplacement);
router.patch('/:id/end', authenticateToken, endReplacement);
router.delete('/:id', authenticateToken, deleteReplacement);

module.exports = router;
