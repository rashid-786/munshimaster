const express = require('express');
const router = express.Router();
const { clockIn, clockOut, adminLogAttendance, deleteAttendance, adminSetStatus, applyLeave, updateLeaveStatus, getTenantLeaves, getEmployeeCalendar } = require('../controllers/time.controller');
const { authenticateToken } = require('../middleware/auth');

// All endpoints require verified multi-tenant contexts
router.post('/attendance/clock-in', authenticateToken, clockIn);
router.post('/attendance/clock-out', authenticateToken, clockOut);
router.post('/attendance/admin-log', authenticateToken, adminLogAttendance);
router.delete('/attendance/admin-log/:employeeId/:date', authenticateToken, deleteAttendance);
router.post('/attendance/admin-set-status', authenticateToken, adminSetStatus);
router.post('/leaves/apply', authenticateToken, applyLeave);
router.patch('/leaves/review', authenticateToken, updateLeaveStatus);
router.get('/leaves', authenticateToken, getTenantLeaves);
router.get('/attendance/calendar', authenticateToken, getEmployeeCalendar);

module.exports = router;
