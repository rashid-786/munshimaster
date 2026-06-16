const express = require('express');
const router = express.Router();
const { createEmployee, getEmployees, updateEmployee, deactivateEmployee, activateEmployee, deleteEmployee } = require('../controllers/employee.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, createEmployee);
router.get('/', authenticateToken, getEmployees);
router.put('/:id', authenticateToken, updateEmployee);
router.patch('/:id/deactivate', authenticateToken, deactivateEmployee);
router.patch('/:id/activate', authenticateToken, activateEmployee);
router.delete('/:id', authenticateToken, deleteEmployee);

module.exports = router;
