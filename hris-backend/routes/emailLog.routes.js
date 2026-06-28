const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getLogs } = require('../controllers/emailLog.controller');

router.get('/', authenticateToken, getLogs);

module.exports = router;
