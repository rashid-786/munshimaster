const express = require('express');
const router = express.Router();
const { calculatePayroll, getPayrollHistory, downloadPayslip, markPayrollPaid } = require('../controllers/payroll.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/calculate', authenticateToken, calculatePayroll);
router.get('/history', authenticateToken, getPayrollHistory);
router.get('/download/:payrollId', authenticateToken, downloadPayslip);
router.patch('/:payrollId/pay', authenticateToken, markPayrollPaid);

module.exports = router;
