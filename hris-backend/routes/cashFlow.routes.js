const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/cashFlow.controller');

router.get('/', ctrl.get);

module.exports = router;
