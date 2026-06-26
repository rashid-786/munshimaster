const { parsePhoneNumber } = require('libphonenumber-js');

function validateE164(phone) {
  if (!phone || typeof phone !== 'string') return null;
  try {
    const parsed = parsePhoneNumber(phone);
    if (!parsed || !parsed.isValid()) return null;
    return {
      phone_e164: parsed.format('E.164'),
      country_code: parsed.country,
      calling_code: `+${parsed.countryCallingCode}`,
      national_number: parsed.nationalNumber,
    };
  } catch {
    return null;
  }
}

module.exports = { validateE164 };
