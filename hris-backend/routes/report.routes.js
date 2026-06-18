const express = require('express');
const router = express.Router();
const { getReportData, downloadPDF, downloadExcel } = require('../controllers/report.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, getReportData);
router.get('/download/pdf', authenticateToken, downloadPDF);
router.get('/download/excel', authenticateToken, downloadExcel);

module.exports = router;
