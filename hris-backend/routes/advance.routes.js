const express = require('express');
const router = express.Router();
const { createAdvance, getAdvances, approveAdvance, rejectAdvance } = require('../controllers/advance.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, createAdvance);
router.get('/', authenticateToken, getAdvances);
router.patch('/:id/approve', authenticateToken, approveAdvance);
router.patch('/:id/reject', authenticateToken, rejectAdvance);

module.exports = router;
