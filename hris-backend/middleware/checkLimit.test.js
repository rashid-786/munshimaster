jest.mock('../services/usage.service', () => ({
  checkUsage: jest.fn(),
}));

const { checkLimit } = require('./checkLimit');
const { checkUsage } = require('../services/usage.service');

describe('checkLimit', () => {
  let req, res, next;

  const withTenant = (plan = 'FREE') => ({
    tenant: { id: 't-1', subscription_plan: plan, status: 'active' },
  });

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('tenant context missing', () => {
    test('returns 401 when req.tenant is undefined', async () => {
      await checkLimit('entities')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'LIMIT_REACHED',
        currentUsage: 0,
        allowedLimit: 0,
        upgradeRequired: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when req.tenant is null', async () => {
      req.tenant = null;
      await checkLimit('entities')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('limit allowed', () => {
    test('calls next when usage is under the limit', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockResolvedValue({ allowed: true, currentUsage: 0, allowedLimit: 1 });

      await checkLimit('entities')(req, res, next);

      expect(checkUsage).toHaveBeenCalledWith({
        tenantId: 't-1',
        plan: 'FREE',
        limitKey: 'entities',
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('limit exceeded', () => {
    test('returns 403 when usage meets the limit', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockResolvedValue({ allowed: false, currentUsage: 1, allowedLimit: 1 });

      await checkLimit('entities')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'LIMIT_REACHED',
        currentUsage: 1,
        allowedLimit: 1,
        upgradeRequired: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when usage exceeds the limit', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockResolvedValue({ allowed: false, currentUsage: 3, allowedLimit: 1 });

      await checkLimit('entities')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'LIMIT_REACHED',
        currentUsage: 3,
        allowedLimit: 1,
        upgradeRequired: true,
      });
    });
  });

  describe('multiple limit keys', () => {
    test('passes correct limitKey to service', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockResolvedValue({ allowed: true, currentUsage: 0, allowedLimit: 500 });

      await checkLimit('transactions')(req, res, next);

      expect(checkUsage).toHaveBeenCalledWith({
        tenantId: 't-1',
        plan: 'FREE',
        limitKey: 'transactions',
      });
      expect(next).toHaveBeenCalled();
    });

    test('works for cashbook_entries', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockResolvedValue({ allowed: false, currentUsage: 500, allowedLimit: 500 });

      await checkLimit('cashbook_entries')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('works for staff_count', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockResolvedValue({ allowed: true, currentUsage: 1, allowedLimit: 2 });

      await checkLimit('staff_count')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('returns 500 when service throws', async () => {
      Object.assign(req, withTenant('FREE'));
      checkUsage.mockRejectedValue(new Error('Unexpected error'));

      await checkLimit('entities')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to check usage limit.' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
