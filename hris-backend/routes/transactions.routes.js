const router = require('express').Router();
const ctrl = require('../controllers/transactions.controller');

router.get('/', ctrl.list);
router.post('/seed', ctrl.seed);
router.get('/summary', ctrl.summary);
router.get('/outstanding', ctrl.getOutstanding);
router.get('/:id', ctrl.get);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/status', ctrl.updateStatus);
router.post('/:id/convert', ctrl.convert);
router.post('/:id/cancel', ctrl.cancel);
router.delete('/:id', ctrl.delete);
router.get('/:id/pdf', ctrl.downloadPDF);

module.exports = router;
