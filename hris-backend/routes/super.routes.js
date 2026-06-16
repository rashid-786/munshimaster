const express = require('express');
const router = express.Router();
const superController = require('../controllers/super.controller');
const { authenticateSuperAdmin } = require('../middleware/superAdmin');

router.post('/auth/seed', superController.seedSuperAdmin);
router.post('/auth/login', superController.loginSuperAdmin);

router.get('/dashboard', authenticateSuperAdmin, superController.getDashboard);

router.post('/tenants', authenticateSuperAdmin, superController.createTenant);
router.get('/tenants', authenticateSuperAdmin, superController.getTenants);
router.get('/tenants/:id', authenticateSuperAdmin, superController.getTenantDetail);
router.put('/tenants/:id', authenticateSuperAdmin, superController.updateTenant);
router.put('/tenants/:id/admin', authenticateSuperAdmin, superController.updateTenantAdmin);
router.delete('/tenants/:id', authenticateSuperAdmin, superController.deleteTenant);

router.get('/employees', authenticateSuperAdmin, superController.getAllEmployees);
router.put('/employees/:id', authenticateSuperAdmin, superController.updateSuperEmployee);

router.get('/tenants/:id/calendar', authenticateSuperAdmin, superController.getTenantCalendar);
router.get('/tenants/:id/payroll', authenticateSuperAdmin, superController.getTenantPayroll);
router.get('/tenants/:id/leaves', authenticateSuperAdmin, superController.getTenantLeaves);

module.exports = router;
