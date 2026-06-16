const express = require('express');
const router = express.Router();
const { registerTenant, loginEmployee, changePassword } = require('../controllers/auth.controller');

router.post('/register', registerTenant);
router.post('/login', loginEmployee);

module.exports = router;
