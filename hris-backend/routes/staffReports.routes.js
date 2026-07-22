const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getSummary, getSalaryReport, getWorkingHoursReport,
  getLeaveReport, getAdvanceReport, getPieceWorkReport,
  exportReport, getCharts,
} = require('../controllers/staffReports.controller');

router.get('/summary', authenticateToken, getSummary);
router.get('/salary', authenticateToken, getSalaryReport);
router.get('/working-hours', authenticateToken, getWorkingHoursReport);
router.get('/leaves', authenticateToken, getLeaveReport);
router.get('/advances', authenticateToken, getAdvanceReport);
router.get('/piece-work', authenticateToken, getPieceWorkReport);
router.get('/charts', authenticateToken, getCharts);
router.get('/export/:tab/:format', authenticateToken, exportReport);

module.exports = router;
