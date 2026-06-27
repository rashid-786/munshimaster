const express = require('express');
const router = express.Router();
const { registerTenant, loginEmployee } = require('../controllers/auth.controller');
const { getPlans } = require('../controllers/subscription.controller');
const otpController = require('../controllers/otp.controller');
const authController = require('../controllers/auth.controller');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerTenant);
router.post('/login', authLimiter, loginEmployee);
router.post('/send-otp', otpLimiter, otpController.sendOtp);
router.post('/verify-otp', otpLimiter, otpController.verifyOtp);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/plans', getPlans);

module.exports = router;
