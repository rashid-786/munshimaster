const express = require('express');
const router = express.Router();
const gstReturnController = require('../controllers/gstReturn.controller');

router.get('/gstr1', gstReturnController.getGstr1);
router.get('/gstr1/download', gstReturnController.downloadGstr1Json);
router.get('/gstr3b', gstReturnController.getGstr3b);

module.exports = router;
