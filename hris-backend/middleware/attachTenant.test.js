jest.mock('../config/db', () => ({
  execute: jest.fn(),
}));

const { attachTenant } = require('./attachTenant');
const db = require('../config/db');

describe('attachTenant', () => {
  let req, res, next;

  beforeEach(() => {
    req = { tenantId: 'tenant-123' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('returns 400 when tenantId is missing', async () => {
    req.tenantId = undefined;

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant context missing.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 404 when tenant is not found', async () => {
    db.execute.mockResolvedValue([[]]);

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant not found.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when tenant status is inactive', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: 'BUSINESS',
      subscription_status: 'active',
      status: 'inactive',
    }]]);

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant account is inactive.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when subscription is expired', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: 'BUSINESS',
      subscription_status: 'expired',
      status: 'active',
    }]]);

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Subscription expired.',
      message: 'Your subscription has expired. Please renew to continue using the service.',
      subscription_status: 'expired',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when subscription is past_due', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: 'BUSINESS',
      subscription_status: 'past_due',
      status: 'active',
    }]]);

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Subscription expired.',
      message: 'Your subscription has expired. Please renew to continue using the service.',
      subscription_status: 'past_due',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when subscription is cancelled', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: 'BUSINESS',
      subscription_status: 'cancelled',
      status: 'active',
    }]]);

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Subscription cancelled.',
      message: 'Your subscription has been cancelled. Please contact support to reactivate.',
      subscription_status: 'cancelled',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches tenant and calls next for active subscription', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: 'BUSINESS',
      subscription_status: 'active',
      status: 'active',
    }]]);

    await attachTenant(req, res, next);

    expect(req.tenant).toEqual({
      id: 'tenant-123',
      subscription_plan: 'BUSINESS',
      status: 'active',
    });
    expect(next).toHaveBeenCalled();
  });

  test('attaches tenant and calls next for trialing subscription', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: 'FREE',
      subscription_status: 'trialing',
      status: 'active',
    }]]);

    await attachTenant(req, res, next);

    expect(req.tenant).toEqual({
      id: 'tenant-123',
      subscription_plan: 'FREE',
      status: 'trialing',
    });
    expect(next).toHaveBeenCalled();
  });

  test('defaults subscription_plan to FREE when null', async () => {
    db.execute.mockResolvedValue([[{
      id: 'tenant-123',
      subscription_plan: null,
      subscription_status: 'active',
      status: 'active',
    }]]);

    await attachTenant(req, res, next);

    expect(req.tenant.subscription_plan).toBe('FREE');
    expect(next).toHaveBeenCalled();
  });

  test('returns 500 when database query throws', async () => {
    db.execute.mockRejectedValue(new Error('DB connection lost'));

    await attachTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load tenant context.' });
    expect(next).not.toHaveBeenCalled();
  });
});
