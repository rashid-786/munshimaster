const { trialWarningHtml, referralHtml } = require('./email');

describe('trialWarningHtml', () => {
  test('includes company name and days left', () => {
    const html = trialWarningHtml({ companyName: 'Test Corp', daysLeft: 7, planName: 'Business' });
    expect(html).toContain('Test Corp');
    expect(html).toContain('7 days');
    expect(html).toContain('Business');
  });

  test('shows urgency for 1 day left', () => {
    const html = trialWarningHtml({ companyName: 'X', daysLeft: 1, planName: 'Pro' });
    expect(html).toContain('expires TODAY');
    expect(html).toContain('Upgrade Now');
  });

  test('shows warning for 3 days left', () => {
    const html = trialWarningHtml({ companyName: 'X', daysLeft: 3, planName: 'Business' });
    expect(html).toContain('ends in 3 days');
  });

  test('includes upgrade link', () => {
    const html = trialWarningHtml({ companyName: 'X', daysLeft: 7, planName: 'Business' });
    expect(html).toContain('href=');
    expect(html).toContain('/admin/settings?tab=plan');
  });
});

describe('referralHtml', () => {
  test('includes referrer name and reward months', () => {
    const html = referralHtml({ referrerName: 'Alice', rewardMonths: 1 });
    expect(html).toContain('Alice');
    expect(html).toContain('1 month');
  });

  test('handles plural months', () => {
    const html = referralHtml({ referrerName: 'Bob', rewardMonths: 2 });
    expect(html).toContain('2 months');
  });
});
