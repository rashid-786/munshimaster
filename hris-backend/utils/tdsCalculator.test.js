jest.mock('pg', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const Pool = jest.fn(() => ({ query: mockQuery, on: jest.fn() }));
  return { Pool };
});

const { computeTds, getTdsPeriod, TDS_SECTIONS } = require('./tdsCalculator');

describe('TDS_SECTIONS', () => {
  test('has all required sections', () => {
    const sections = Object.keys(TDS_SECTIONS);
    expect(sections).toContain('194C');
    expect(sections).toContain('194J');
    expect(sections).toContain('194H');
    expect(sections).toContain('194I');
    expect(sections).toContain('194IA');
    expect(sections).toContain('194D');
    expect(sections).toContain('194M');
    expect(sections).toContain('194O');
    expect(sections).toContain('Other');
  });
});

describe('computeTds', () => {
  test('returns zero when amount below threshold for 194C', () => {
    const result = computeTds(25000, '194C', null);
    expect(result.tdsAmount).toBe(0);
    expect(result.applicable).toBe(false);
    expect(result.reason).toBe('Below threshold');
  });

  test('calculates TDS at 1% for 194C above threshold', () => {
    const result = computeTds(100000, '194C', null);
    expect(result.tdsAmount).toBe(1000); // 100000 * 1%
    expect(result.applicable).toBe(true);
    expect(result.tdsRate).toBe(1.0);
  });

  test('uses custom rate when provided', () => {
    const result = computeTds(100000, '194C', 2.0);
    expect(result.tdsAmount).toBe(2000);
    expect(result.tdsRate).toBe(2.0);
  });

  test('returns zero for 194J below threshold', () => {
    const result = computeTds(25000, '194J', null);
    expect(result.tdsAmount).toBe(0);
    expect(result.applicable).toBe(false);
  });

  test('calculates 194J at 10% above threshold', () => {
    const result = computeTds(50000, '194J', null);
    expect(result.tdsAmount).toBe(5000); // 50000 * 10%
  });

  test('handles 194H commission threshold (15,000)', () => {
    const below = computeTds(14000, '194H', null);
    expect(below.applicable).toBe(false);
    const above = computeTds(20000, '194H', null);
    expect(above.tdsAmount).toBe(1000); // 20000 * 5%
  });

  test('handles 194I rent threshold (2,40,000)', () => {
    const below = computeTds(200000, '194I', null);
    expect(below.applicable).toBe(false);
    const above = computeTds(300000, '194I', null);
    expect(above.tdsAmount).toBe(30000); // 300000 * 10%
  });

  test('194IA rent PM at 2%', () => {
    const result = computeTds(500000, '194IA', null);
    expect(result.tdsAmount).toBe(10000); // 500000 * 2%
  });

  test('194O has no threshold', () => {
    const result = computeTds(100, '194O', null);
    expect(result.applicable).toBe(true);
    expect(result.tdsAmount).toBe(1); // 100 * 1%
  });

  test('falls back to Other section for unknown section', () => {
    const result = computeTds(50000, 'UnknownSection', null);
    expect(result.applicable).toBe(true);
    expect(result.tdsAmount).toBe(5000); // 50000 * 10% (Other default)
    expect(result.tdsRate).toBe(10.0);
  });

  test('handles edge case: amount exactly at threshold', () => {
    const result = computeTds(30000, '194C', null);
    expect(result.applicable).toBe(false);
    expect(result.tdsAmount).toBe(0);
  });

  test('rounds TDS to 2 decimal places', () => {
    const result = computeTds(33333, '194C', null);
    expect(result.tdsAmount).toBe(333.33); // 33333 * 1% = 333.33
  });

  test('handles zero amount', () => {
    const result = computeTds(0, '194C', null);
    expect(result.tdsAmount).toBe(0);
    expect(result.applicable).toBe(false);
  });
});

describe('getTdsPeriod', () => {
  test('returns Q1 for April', () => {
    expect(getTdsPeriod('2026-04-15')).toBe('Q126');
  });

  test('returns Q2 for July', () => {
    expect(getTdsPeriod('2026-07-01')).toBe('Q226');
  });

  test('returns Q3 for October', () => {
    expect(getTdsPeriod('2026-10-20')).toBe('Q326');
  });

  test('returns Q4 for January', () => {
    expect(getTdsPeriod('2026-01-10')).toBe('Q426');
  });

  test('handles null/undefined', () => {
    expect(getTdsPeriod(null)).toBeNull();
    expect(getTdsPeriod(undefined)).toBeNull();
  });
});
