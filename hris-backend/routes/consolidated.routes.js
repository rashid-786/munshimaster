const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/consolidated.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/pl', authenticateToken, ctrl.consolidatedPL);

module.exports = router;
