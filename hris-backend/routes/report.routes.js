const express = require('express');
const router = express.Router();
const { getReportData, downloadPDF, downloadExcel, getPLStatement } = require('../controllers/report.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getReportData);
router.get('/download/pdf', authenticateToken, downloadPDF);
router.get('/download/excel', authenticateToken, downloadExcel);
router.get('/pl', authenticateToken, getPLStatement);

module.exports = router;
