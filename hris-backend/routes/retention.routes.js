const express = require('express');
const router = express.Router();
const retentionController = require('../controllers/retention.controller');
const { authenticateToken } = require('../middleware/auth');

// Referrals
router.get('/referral/code', authenticateToken, retentionController.getOrCreateReferralCode);
router.post('/referral/redeem', authenticateToken, retentionController.redeemReferral);
router.get('/referral/stats', authenticateToken, retentionController.getReferralStats);

// Campaigns / Promo
router.get('/campaigns', authenticateToken, retentionController.getActiveCampaigns);
router.post('/promo/validate', authenticateToken, retentionController.applyPromoCode);
router.post('/promo/redeem', authenticateToken, retentionController.redeemPromoCode);

// Analytics (super admin)
router.get('/analytics', authenticateToken, retentionController.getAnalytics);

// Manual trial expiry check (admin trigger)
router.post('/notify-trial-expiry', authenticateToken, retentionController.sendTrialExpiryNotifications);

// Onboarding
router.get('/onboarding', authenticateToken, retentionController.getOnboardingStatus);
router.post('/onboarding/complete', authenticateToken, retentionController.completeOnboarding);

module.exports = router;
