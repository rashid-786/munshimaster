const express = require('express');
const router = express.Router();
const { calculatePayroll, previewPayroll, getPayrollHistory, getDueSummary, downloadPayslip, markPayrollPaid, deletePayrollHistory, updateManualAdvanceDeduction } = require('../controllers/payroll.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/calculate', authenticateToken, calculatePayroll);
router.post('/preview', authenticateToken, previewPayroll);
router.get('/history', authenticateToken, getPayrollHistory);
router.get('/due-summary', authenticateToken, getDueSummary);
router.get('/download/:payrollId', authenticateToken, downloadPayslip);
router.patch('/:payrollId/pay', authenticateToken, markPayrollPaid);
router.patch('/:payrollId/manual-advance-deduction', authenticateToken, updateManualAdvanceDeduction);
router.post('/batch-delete', authenticateToken, deletePayrollHistory);

module.exports = router;
