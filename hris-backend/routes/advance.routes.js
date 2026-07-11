const express = require('express');
const router = express.Router();
const { createAdvance, getAdvances, approveAdvance, rejectAdvance, updateAdvance, deleteAdvance } = require('../controllers/advance.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, createAdvance);
router.get('/', authenticateToken, getAdvances);
router.put('/:id', authenticateToken, updateAdvance);
router.delete('/:id', authenticateToken, deleteAdvance);
router.patch('/:id/approve', authenticateToken, approveAdvance);
router.patch('/:id/reject', authenticateToken, rejectAdvance);

module.exports = router;
