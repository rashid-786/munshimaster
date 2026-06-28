const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tds.controller');

router.get('/sections', ctrl.getSections);
router.get('/deductions', ctrl.getDeductions);
router.post('/deductions', ctrl.createDeduction);
router.put('/deductions/:id', ctrl.updateDeduction);
router.delete('/deductions/:id', ctrl.deleteDeduction);
router.get('/challans', ctrl.getChallans);
router.post('/challans', ctrl.createChallan);
router.post('/link-challan', ctrl.linkChallan);
router.get('/summary', ctrl.summary);

module.exports = router;
