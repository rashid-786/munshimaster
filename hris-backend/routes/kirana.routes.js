const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/kirana.controller');
const { authenticateToken } = require('../middleware/auth');

// Parties
router.post('/parties', authenticateToken, ctrl.createParty);
router.get('/parties', authenticateToken, ctrl.getParties);
router.get('/parties/:id', authenticateToken, ctrl.getPartyDetails);
router.put('/parties/:id', authenticateToken, ctrl.updateParty);
router.delete('/parties/:id', authenticateToken, ctrl.deleteParty);

// Transactions
router.post('/transactions', authenticateToken, ctrl.createTransaction);
router.get('/transactions', authenticateToken, ctrl.getTransactions);
router.delete('/transactions/:id', authenticateToken, ctrl.deleteTransaction);

// Summary
router.get('/summary', authenticateToken, ctrl.getSummary);

// Cash flow (monthly trend)
router.get('/cashflow', authenticateToken, ctrl.getCashflow);

// Cashbook
router.post('/cashbook', authenticateToken, ctrl.createCashEntry);
router.get('/cashbook', authenticateToken, ctrl.getCashbook);
router.put('/cashbook/:id', authenticateToken, ctrl.updateCashEntry);
router.delete('/cashbook/:id', authenticateToken, ctrl.deleteCashEntry);

// Invoices
router.get('/invoices/next-number', authenticateToken, ctrl.getNextNumber);
router.post('/invoices', authenticateToken, ctrl.createInvoice);
router.get('/invoices', authenticateToken, ctrl.getInvoices);
router.get('/invoices/:id', authenticateToken, ctrl.getInvoice);
router.put('/invoices/:id', authenticateToken, ctrl.updateInvoice);
router.delete('/invoices/:id', authenticateToken, ctrl.deleteInvoice);
router.patch('/invoices/:id/status', authenticateToken, ctrl.updateInvoiceStatus);

// Reports
router.get('/reports', authenticateToken, ctrl.getReport);
router.get('/reports/download/excel', authenticateToken, ctrl.downloadReportExcel);

module.exports = router;
