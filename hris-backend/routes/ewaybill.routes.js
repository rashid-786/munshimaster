const express = require('express');
const router = express.Router();
const ewaybillController = require('../controllers/ewaybill.controller');

router.post('/:id/generate', ewaybillController.generate);
router.post('/:id/cancel', ewaybillController.cancel);
router.get('/:id/status', ewaybillController.status);

module.exports = router;
