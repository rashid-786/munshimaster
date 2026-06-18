const express = require('express');
const router = express.Router();
const { createEntry, getEntries, updateEntry, deleteEntry } = require('../controllers/balance.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, createEntry);
router.get('/', authenticateToken, getEntries);
router.put('/:id', authenticateToken, updateEntry);
router.delete('/:id', authenticateToken, deleteEntry);

module.exports = router;
