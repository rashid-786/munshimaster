const express = require('express');
const router = express.Router();
const { createEntry, getEntries, updateEntry, deleteEntry, getSummary, markAsPaid, unmarkPaid, getUnpaidEntries, getEmployeeEntries, getEmployeeRates, saveDayEntries, getCalendarData, createWorkType, updateWorkType, deleteWorkType } = require('../controllers/pieceWork.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/employee-rates', authenticateToken, getEmployeeRates);
router.post('/work-types', authenticateToken, createWorkType);
router.put('/work-types/:id', authenticateToken, updateWorkType);
router.delete('/work-types/:id', authenticateToken, deleteWorkType);
router.get('/calendar-data', authenticateToken, getCalendarData);
router.post('/save-day', authenticateToken, saveDayEntries);
router.post('/', authenticateToken, createEntry);
router.get('/', authenticateToken, getEntries);
router.get('/summary', authenticateToken, getSummary);
router.get('/employee-entries', authenticateToken, getEmployeeEntries);
router.get('/unpaid', authenticateToken, getUnpaidEntries);
router.put('/:id', authenticateToken, updateEntry);
router.delete('/:id', authenticateToken, deleteEntry);
router.post('/mark-paid', authenticateToken, markAsPaid);
router.post('/unmark-paid/:payrollId', authenticateToken, unmarkPaid);

module.exports = router;
