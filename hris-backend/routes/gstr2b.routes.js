const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/gstr2b.controller');

router.post('/upload', ctrl.upload);
router.get('/imports', ctrl.getImports);
router.get('/items', ctrl.getItems);
router.get('/stats', ctrl.stats);
router.post('/items/:id/match', ctrl.matchItem);
router.post('/items/:id/unmatch', ctrl.unmatchItem);
router.delete('/imports/:id', ctrl.deleteImport);

module.exports = router;
