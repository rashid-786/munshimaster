const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { planRank } = require('../utils/subscription');
const { getReportData, downloadPDF, downloadExcel, getPLStatement } = require('../controllers/report.controller');
const { authenticateToken } = require('../middleware/auth');

const ADVANCED_REPORT_TYPES = ['sales_by_customer', 'purchases_by_supplier', 'ar_aging', 'ap_aging', 'invoice_status_summary', 'gst_summary'];

async function proGateForAdvancedReports(req, res, next) {
  const type = req.query.type || req.body?.type;
  if (type && ADVANCED_REPORT_TYPES.includes(type)) {
    const tenantId = req.tenantId;
    try {
      const [rows] = await db.execute('SELECT subscription_plan FROM tenants WHERE id = ?', [tenantId]);
      const currentPlan = rows[0]?.subscription_plan || 'free';
      if (planRank(currentPlan) < 2) {
        return res.status(403).json({
          error: 'Upgrade required.',
          message: `This report requires Business Pro plan. Your current plan is ${currentPlan}.`,
          currentPlan,
          requiredPlan: 'business_pro',
        });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to verify subscription plan.' });
    }
  }
  next();
}

router.get('/', authenticateToken, proGateForAdvancedReports, getReportData);
router.get('/download/pdf', authenticateToken, proGateForAdvancedReports, downloadPDF);
router.get('/download/excel', authenticateToken, proGateForAdvancedReports, downloadExcel);
router.get('/pl', authenticateToken, getPLStatement);

module.exports = router;
