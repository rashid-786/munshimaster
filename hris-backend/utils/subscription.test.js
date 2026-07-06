const mockPool = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  on: jest.fn(),
};

jest.mock('pg', () => {
  const Pool = jest.fn(() => mockPool);
  return { Pool };
});

const { planRank, PLAN_RANK } = require('./subscription');

describe('planRank', () => {
  test('returns correct rank for free plan', () => {
    expect(planRank('free')).toBe(0);
  });

  test('returns correct rank for business plan', () => {
    expect(planRank('business')).toBe(1);
  });

  test('returns correct rank for pro plan', () => {
    expect(planRank('pro')).toBe(3); // pro = Business Pro
  });

  test('handles legacy plan name "pro" (old = business)', () => {
    // PLAN_RANK maps pro→3 (pro = new Business Pro)
    expect(planRank('pro')).toBe(3); // PLAN_RANK takes priority
  });

  test('handles legacy plan name "enterprise" (old = pro)', () => {
    expect(planRank('enterprise')).toBe(2);
  });

  test('returns 0 for unknown plan', () => {
    expect(planRank('unknown')).toBe(0);
  });

  test('returns 0 for undefined/null', () => {
    expect(planRank(undefined)).toBe(0);
    expect(planRank(null)).toBe(0);
  });
});

describe('PLAN_RANK constant', () => {
  test('free is less than business', () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.business);
  });

  test('business is less than pro', () => {
    expect(PLAN_RANK.business).toBeLessThan(PLAN_RANK.pro);
  });
});
