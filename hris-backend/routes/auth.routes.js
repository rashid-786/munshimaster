const express = require('express');
const router = express.Router();
const { registerTenant, loginEmployee } = require('../controllers/auth.controller');
const { getPlans } = require('../controllers/subscription.controller');
const otpController = require('../controllers/otp.controller');
const authController = require('../controllers/auth.controller');

router.post('/register', registerTenant);
router.post('/login', loginEmployee);
router.post('/send-otp', otpController.sendOtp);
router.post('/verify-otp', otpController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.get('/plans', getPlans);

module.exports = router;
