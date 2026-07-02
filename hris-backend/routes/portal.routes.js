const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/portal.controller');

router.get('/:token', ctrl.verifyToken);
router.get('/:token/invoices/:invoiceId/download', ctrl.downloadInvoice);

module.exports = router;
