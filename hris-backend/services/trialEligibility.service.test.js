const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
};

jest.mock('pg', () => {
  const Pool = jest.fn(() => mockPool);
  return { Pool };
});

const {
  assertTrialEligible,
  hasUsedTrial,
  resolveTenantIdsByPhone,
  TrialNotEligibleError,
  TRIAL_RESTRICTION_MESSAGE,
} = require('./trialEligibility.service');

function mockQueries({ tenantRows = [], subCount = '0', eventCount = '0' } = {}) {
  mockPool.query.mockImplementation((text) => {
    if (text.includes('FROM hris_saas.tenants t')) {
      return Promise.resolve({ rows: tenantRows });
    }
    if (text.includes('FROM hris_saas.subscriptions s')) {
      return Promise.resolve({ rows: [{ c: subCount }] });
    }
    if (text.includes('FROM hris_saas.subscription_events e')) {
      return Promise.resolve({ rows: [{ c: eventCount }] });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveTenantIdsByPhone', () => {
  test('returns empty array for missing phone', async () => {
    await expect(resolveTenantIdsByPhone(null)).resolves.toEqual([]);
    await expect(resolveTenantIdsByPhone('')).resolves.toEqual([]);
  });

  test('returns tenant ids found for the phone', async () => {
    mockQueries({ tenantRows: [{ id: 'a' }, { id: 'b' }] });
    const ids = await resolveTenantIdsByPhone('+917838087800');
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('hasUsedTrial', () => {
  test('returns false when no trial subscription exists', async () => {
    mockQueries({ subCount: '0', eventCount: '0' });
    await expect(hasUsedTrial(['a'])).resolves.toBe(false);
  });

  test('returns true when a subscription has trial_ends_at', async () => {
    mockQueries({ subCount: '1' });
    await expect(hasUsedTrial(['a'])).resolves.toBe(true);
  });

  test('returns true when a trial_start event exists', async () => {
    mockQueries({ subCount: '0', eventCount: '1' });
    await expect(hasUsedTrial(['a'])).resolves.toBe(true);
  });

  test('returns false for empty tenant list', async () => {
    await expect(hasUsedTrial([])).resolves.toBe(false);
  });
});

describe('assertTrialEligible', () => {
  test('throws TrialNotEligibleError when the phone already consumed a trial', async () => {
    mockQueries({ tenantRows: [{ id: 'tenant-1' }], subCount: '1' });
    await expect(assertTrialEligible('tenant-1', '+917838087800')).rejects.toBeInstanceOf(
      TrialNotEligibleError,
    );
  });

  test('throws TrialNotEligibleError with a clear message', async () => {
    mockQueries({ tenantRows: [{ id: 'tenant-1' }], subCount: '1' });
    await expect(assertTrialEligible('tenant-1', '+917838087800')).rejects.toThrow(
      TRIAL_RESTRICTION_MESSAGE,
    );
  });

  test('passes when no trial was ever consumed', async () => {
    mockQueries({ tenantRows: [{ id: 'tenant-1' }], subCount: '0', eventCount: '0' });
    await expect(assertTrialEligible('tenant-1', '+917838087800')).resolves.toBeUndefined();
  });

  test('passes when the caller force-overrides the restriction', async () => {
    mockQueries({ tenantRows: [{ id: 'tenant-1' }], subCount: '1' });
    await expect(
      assertTrialEligible('tenant-1', '+917838087800', { force: true }),
    ).resolves.toBeUndefined();
  });
});