const express = require('express');
const router = express.Router();
const multer = require('multer');
const ctrl = require('../controllers/bulkImport.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/:entityType/preview', upload.single('file'), ctrl.preview);
router.post('/:entityType/confirm', ctrl.confirm);

module.exports = router;
