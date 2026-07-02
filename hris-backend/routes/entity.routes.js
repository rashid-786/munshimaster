const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/entity.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, ctrl.list);
router.post('/', authenticateToken, ctrl.create);
router.post('/switch', authenticateToken, ctrl.switch);
router.put('/:id', authenticateToken, ctrl.update);
router.delete('/:id', authenticateToken, ctrl.remove);

module.exports = router;
