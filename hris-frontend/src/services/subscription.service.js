import api from './api';

export const subscriptionService = {
  getPlans: async () => {
    const res = await api.get('/core/subscription/plans');
    return res.data.plans;
  },

  getCurrent: async () => {
    const res = await api.get('/core/subscription/plan');
    return res.data;
  },

  checkFeature: async (feature) => {
    const res = await api.get('/core/subscription/check-feature', { params: { feature } });
    return res.data;
  },

  createOrder: async (planId) => {
    const res = await api.post('/core/subscription/create-order', { planId });
    return res.data;
  },

  verifyPayment: async (data) => {
    const res = await api.post('/core/subscription/verify-payment', data);
    return res.data;
  },

  cancelOrder: async (orderId) => {
    const res = await api.post('/core/subscription/cancel-order', { orderId });
    return res.data;
  },

  startTrial: async (planId) => {
    const res = await api.post('/core/subscription/start-trial', { planId });
    return res.data;
  },

  getPaymentHistory: async () => {
    const res = await api.get('/core/subscription/payments');
    return res.data;
  },

  downloadReceipt: async (paymentId) => {
    const token = localStorage.getItem('auth_token');
    const tenantId = localStorage.getItem('tenant_id');
    const baseUrl = api.defaults.baseURL || '';
    const url = `${baseUrl}/core/subscription/payments/${paymentId}/receipt?token=${encodeURIComponent(token || '')}&tenantId=${encodeURIComponent(tenantId || '')}`;
    window.open(url, '_blank');
  },

  getDowngradePreview: async () => {
    const res = await api.get('/core/subscription/downgrade-preview');
    return res.data;
  },

  cancelSubscription: async () => {
    const res = await api.post('/core/subscription/cancel');
    return res.data;
  },

  downgradeToFree: async () => {
    const res = await api.post('/core/subscription/downgrade');
    return res.data;
  },

  getUsage: async () => {
    const res = await api.get('/core/subscription/usage');
    return res.data;
  },

  getOnboardingStatus: async () => {
    const res = await api.get('/core/retention/onboarding');
    return res.data;
  },

  completeOnboarding: async () => {
    const res = await api.post('/core/retention/onboarding/complete');
    return res.data;
  },
};
