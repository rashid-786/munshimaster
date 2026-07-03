const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticateToken } = require('../middleware/auth');

// Public
router.get('/plans', subscriptionController.getPlans);

// Authenticated
router.get('/plan', authenticateToken, subscriptionController.getSubscription);
router.put('/plan', authenticateToken, subscriptionController.selectPlan);
router.get('/profile-completion', authenticateToken, subscriptionController.getProfileCompletion);
router.get('/check-feature', authenticateToken, subscriptionController.checkFeature);
router.get('/usage', authenticateToken, subscriptionController.getUsage);

// Razorpay
router.post('/create-order', authenticateToken, subscriptionController.createOrder);
router.post('/verify-payment', authenticateToken, subscriptionController.verifyPayment);
router.post('/cancel-order', authenticateToken, subscriptionController.cancelOrder);
router.post('/start-trial', authenticateToken, subscriptionController.startTrial);

// Payment history & receipts
router.get('/payments', authenticateToken, subscriptionController.getPaymentHistory);
router.get('/payments/:paymentId/receipt', authenticateToken, subscriptionController.getReceipt);

// Downgrade & Cancellation
router.get('/downgrade-preview', authenticateToken, subscriptionController.getDowngradePreview);
router.post('/cancel', authenticateToken, subscriptionController.cancelSubscription);
router.post('/downgrade', authenticateToken, subscriptionController.downgradeToFree);

// Lifecycle management
router.post('/suspend', authenticateToken, subscriptionController.suspendSubscription);
router.post('/reactivate', authenticateToken, subscriptionController.reactivateSubscription);
router.get('/events', authenticateToken, subscriptionController.getEventHistory);

// Webhook (no auth — uses signature verification)
router.post('/webhook', subscriptionController.webhook);

module.exports = router;
