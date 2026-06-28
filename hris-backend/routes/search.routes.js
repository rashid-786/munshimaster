const express = require('express');
const router = express.Router();
const { search } = require('../controllers/search.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, search);

module.exports = router;
