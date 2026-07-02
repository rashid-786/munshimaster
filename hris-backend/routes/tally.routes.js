const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tally.controller');

router.get('/masters', ctrl.masters);
router.get('/customers', ctrl.customers);
router.get('/suppliers', ctrl.suppliers);
router.get('/products', ctrl.products);
router.get('/invoices', ctrl.invoices);
router.get('/purchase-orders', ctrl.purchaseOrders);

module.exports = router;
