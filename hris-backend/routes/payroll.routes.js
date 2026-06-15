const express = require('express');
const router = express.Router();
const { calculatePayroll, getPayrollHistory, downloadPayslip } = require('../controllers/payroll.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/calculate', authenticateToken, calculatePayroll);
router.get('/history', authenticateToken, getPayrollHistory);
router.get('/download/:payrollId', authenticateToken, downloadPayslip);

module.exports = router;
