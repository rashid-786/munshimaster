const { validateE164 } = require('./phone');

describe('validateE164', () => {
  test('returns null for empty input', () => {
    expect(validateE164('')).toBeNull();
    expect(validateE164(null)).toBeNull();
    expect(validateE164(undefined)).toBeNull();
  });

  test('returns parsed data for a valid Indian number', () => {
    const result = validateE164('+919876543210');
    expect(result).not.toBeNull();
    expect(result.phone_e164).toBe('+919876543210');
    expect(result.country_code).toBe('IN');
    expect(result.calling_code).toBe('+91');
    expect(result.national_number).toBe('9876543210');
  });

  test('returns parsed data for a valid Kuwait number', () => {
    const result = validateE164('+96551234567');
    expect(result).not.toBeNull();
    expect(result.phone_e164).toBe('+96551234567');
    expect(result.country_code).toBe('KW');
    expect(result.calling_code).toBe('+965');
  });

  test('returns parsed data for a valid US number', () => {
    const result = validateE164('+12125551234');
    expect(result).not.toBeNull();
    expect(result.phone_e164).toBe('+12125551234');
    expect(result.country_code).toBe('US');
  });

  test('returns null for an invalid number', () => {
    expect(validateE164('+999999999999999')).toBeNull();
  });

  test('returns null for a number without + prefix', () => {
    expect(validateE164('919876543210')).toBeNull();
  });

  test('returns null for gibberish', () => {
    expect(validateE164('not-a-phone')).toBeNull();
  });
});
