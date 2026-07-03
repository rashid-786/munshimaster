const { requireFeature } = require('./requireFeature');

describe('requireFeature', () => {
  let req, res, next;

  const activeTenant = (plan = 'BUSINESS') => ({
    tenant: { id: 't-1', subscription_plan: plan, status: 'active' },
  });

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('tenant context missing', () => {
    test('returns 401 when req.tenant is not set', () => {
      requireFeature('inventory')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'FEATURE_LOCKED',
        feature: 'inventory',
        currentPlan: null,
        upgradeRequired: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when req.tenant is null', () => {
      req.tenant = null;
      requireFeature('inventory')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('unknown feature', () => {
    test('allows access for unknown feature key', () => {
      Object.assign(req, activeTenant('FREE'));
      requireFeature('unknown_feature_xyz')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('staff_directory feature', () => {
    test('allows FREE plan access', () => {
      Object.assign(req, activeTenant('FREE'));
      requireFeature('staff_directory')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('attendance feature', () => {
    test('allows FREE plan access', () => {
      Object.assign(req, activeTenant('FREE'));
      requireFeature('attendance')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('customers feature', () => {
    test('allows FREE plan access', () => {
      Object.assign(req, activeTenant('FREE'));
      requireFeature('customers')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('invoices feature', () => {
    test('allows FREE plan access', () => {
      Object.assign(req, activeTenant('FREE'));
      requireFeature('invoices')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('inventory feature', () => {
    test('blocks FREE plan', () => {
      Object.assign(req, activeTenant('FREE'));
      requireFeature('inventory')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'FEATURE_LOCKED',
        feature: 'inventory',
        currentPlan: 'FREE',
        upgradeRequired: true,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('blocks MANAGE plan', () => {
      Object.assign(req, activeTenant('MANAGE'));
      requireFeature('inventory')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('allows BUSINESS plan', () => {
      Object.assign(req, activeTenant('BUSINESS'));
      requireFeature('inventory')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('allows BUSINESS_PRO plan', () => {
      Object.assign(req, activeTenant('BUSINESS_PRO'));
      requireFeature('inventory')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('payroll feature', () => {
    test('blocks FREE, MANAGE, BUSINESS', () => {
      for (const plan of ['FREE', 'MANAGE', 'BUSINESS']) {
        Object.assign(req, activeTenant(plan));
        requireFeature('payroll')(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        jest.clearAllMocks();
      }
    });

    test('allows BUSINESS_PRO', () => {
      Object.assign(req, activeTenant('BUSINESS_PRO'));
      requireFeature('payroll')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('legacy plan name resolution', () => {
    test('resolves legacy plan names', () => {
      Object.assign(req, activeTenant('business_monthly'));
      requireFeature('inventory')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('null plan defaults to FREE and gets blocked for inventory', () => {
      Object.assign(req, activeTenant(null));
      Object.assign(req.tenant, { subscription_plan: null });
      requireFeature('inventory')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        code: 'FEATURE_LOCKED',
        feature: 'inventory',
        currentPlan: 'FREE',
        upgradeRequired: true,
      });
    });
  });
});
