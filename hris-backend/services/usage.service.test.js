jest.mock('../config/db', () => ({
  execute: jest.fn(),
}));

const { checkUsage } = require('./usage.service');
const db = require('../config/db');

describe('checkUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unknown limit key', () => {
    test('allows access for unrecognized limit key', async () => {
      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'unknown_xyz' });

      expect(result).toEqual({ allowed: true, currentUsage: 0, allowedLimit: -1 });
    });
  });

  describe('unlimited plan dimension', () => {
    test('returns allowed for BUSINESS monthly_transactions', async () => {
      const result = await checkUsage({ tenantId: 't-1', plan: 'BUSINESS', limitKey: 'transactions' });

      expect(result).toEqual({ allowed: true, currentUsage: 0, allowedLimit: -1 });
    });

    test('returns allowed for BUSINESS_PRO staff_count', async () => {
      const result = await checkUsage({ tenantId: 't-1', plan: 'BUSINESS_PRO', limitKey: 'staff_count' });

      expect(result).toEqual({ allowed: true, currentUsage: 0, allowedLimit: -1 });
    });
  });

  describe('entities limit', () => {
    test('allows when usage is under the limit', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 0 }]])
        .mockResolvedValueOnce([[{ count: 0 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'entities' });

      expect(result).toEqual({ allowed: true, currentUsage: 0, allowedLimit: 1 });
    });

    test('blocks when usage meets the limit', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'entities' });

      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(1);
      expect(result.allowedLimit).toBe(1);
    });

    test('falls back to single tenant count when org query returns 0', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 0 }]])
        .mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'entities' });

      expect(result.currentUsage).toBe(1);
      expect(result.allowedLimit).toBe(1);
      expect(result.allowed).toBe(false);
    });

    test('BUSINESS allows up to 3 entities', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 3 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'BUSINESS', limitKey: 'entities' });

      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(3);
      expect(result.allowedLimit).toBe(3);
    });

    test('BUSINESS allows 2 entities', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 2 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'BUSINESS', limitKey: 'entities' });

      expect(result.allowed).toBe(true);
    });
  });

  describe('transactions limit', () => {
    test('FREE allows up to 500 monthly transactions', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 499 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'transactions' });

      expect(result).toEqual({ allowed: true, currentUsage: 499, allowedLimit: 500 });
    });

    test('FREE blocks at 500 monthly transactions', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 500 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'transactions' });

      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(500);
      expect(result.allowedLimit).toBe(500);
    });

    test('MANAGE allows 3000 transactions', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 3000 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'MANAGE', limitKey: 'transactions' });

      expect(result.allowed).toBe(false);
      expect(result.allowedLimit).toBe(3000);
    });
  });

  describe('cashbook_entries limit', () => {
    test('FREE allows 499 entries, blocks at 500', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 499 }]]);

      const under = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'cashbook_entries' });
      expect(under.allowed).toBe(true);

      db.execute
        .mockResolvedValueOnce([[{ count: 500 }]]);

      const over = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'cashbook_entries' });
      expect(over.allowed).toBe(false);
    });
  });

  describe('staff_count limit', () => {
    test('FREE allows up to 2 staff', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'staff_count' });

      expect(result).toEqual({ allowed: true, currentUsage: 1, allowedLimit: 2 });
    });

    test('FREE blocks at 2 staff', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 2 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'staff_count' });

      expect(result.allowed).toBe(false);
    });

    test('BUSINESS allows 25 staff, blocks at 25', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 25 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'BUSINESS', limitKey: 'staff_count' });

      expect(result.allowed).toBe(false);
      expect(result.allowedLimit).toBe(25);
    });
  });

  describe('legacy plan name resolution', () => {
    test('resolves business_monthly to BUSINESS', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 2 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: 'business_monthly', limitKey: 'entities' });

      expect(result).toEqual({ allowed: true, currentUsage: 2, allowedLimit: 3 });
    });

    test('null plan defaults to FREE', async () => {
      db.execute
        .mockResolvedValueOnce([[{ count: 0 }]])
        .mockResolvedValueOnce([[{ count: 1 }]]);

      const result = await checkUsage({ tenantId: 't-1', plan: null, limitKey: 'entities' });

      expect(result).toEqual({ allowed: false, currentUsage: 1, allowedLimit: 1 });
    });
  });

  describe('database error handling', () => {
    test('returns blocked response on query failure', async () => {
      db.execute.mockRejectedValue(new Error('DB connection lost'));

      const result = await checkUsage({ tenantId: 't-1', plan: 'FREE', limitKey: 'entities' });

      expect(result).toEqual({ allowed: false, currentUsage: 0, allowedLimit: 1, error: 'Usage query failed' });
    });
  });
});
