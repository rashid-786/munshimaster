const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/plans', subscriptionController.getPlans);
router.get('/plan', authenticateToken, subscriptionController.getSubscription);
router.put('/plan', authenticateToken, subscriptionController.selectPlan);
router.get('/profile-completion', authenticateToken, subscriptionController.getProfileCompletion);

module.exports = router;
