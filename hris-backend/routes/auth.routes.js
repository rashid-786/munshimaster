const express = require('express');
const router = express.Router();
const { registerTenant, loginEmployee } = require('../controllers/auth.controller');
const tenantResolver = require('../middleware/tenant');

// Public route: A company signs up for your SaaS platform
router.post('/register', registerTenant);

// Tenant-scoped route: Employee logs into their specific company portal
router.post('/login', tenantResolver, loginEmployee);

module.exports = router;
