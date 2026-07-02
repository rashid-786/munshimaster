const express = require('express');
const router = express.Router();
const { getDashboard, getBusinessDashboard } = require('../controllers/dashboard.controller');

router.get('/', getDashboard);
router.get('/business', getBusinessDashboard);

module.exports = router;
