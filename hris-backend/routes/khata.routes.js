const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/khata.controller');

router.get('/summary', ctrl.summary);
router.get('/customers', ctrl.customers);
router.get('/customers/:id', ctrl.customerDetail);
router.post('/customers/:id/token', ctrl.generateToken);
router.post('/customers/:id/reminder', ctrl.sendReminder);

module.exports = router;
