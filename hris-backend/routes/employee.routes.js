const express = require('express');
const router = express.Router();
const { createEmployee, getEmployees } = require('../controllers/employee.controller');
const { authenticateToken } = require('../middleware/auth');

// Both routes require valid login token AND tenant headers
router.post('/', authenticateToken, createEmployee);
router.get('/', authenticateToken, getEmployees);

module.exports = router;
