import React, { useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const COUNTRY_INFO = {
  KW: { national: 8, cc: '+965' }, SA: { national: 9, cc: '+966' }, AE: { national: 9, cc: '+971' },
  QA: { national: 8, cc: '+974' }, BH: { national: 8, cc: '+973' }, OM: { national: 8, cc: '+968' },
  IN: { national: 10, cc: '+91' }, PK: { national: 10, cc: '+92' }, BD: { national: 10, cc: '+880' },
  LK: { national: 10, cc: '+94' }, NP: { national: 10, cc: '+977' },
  EG: { national: 10, cc: '+20' }, MA: { national: 9, cc: '+212' }, TN: { national: 8, cc: '+216' },
  DZ: { national: 9, cc: '+213' }, IQ: { national: 10, cc: '+964' }, JO: { national: 9, cc: '+962' },
  LB: { national: 7, cc: '+961' }, SY: { national: 9, cc: '+963' }, YE: { national: 9, cc: '+967' },
  US: { national: 10, cc: '+1' }, CA: { national: 10, cc: '+1' }, GB: { national: 10, cc: '+44' },
  AU: { national: 9, cc: '+61' }, NZ: { national: 8, cc: '+64' },
  TR: { national: 10, cc: '+90' }, IR: { national: 10, cc: '+98' },
  MY: { national: 9, cc: '+60' }, PH: { national: 10, cc: '+63' }, SG: { national: 8, cc: '+65' },
  TH: { national: 9, cc: '+66' }, VN: { national: 9, cc: '+84' },
  FR: { national: 9, cc: '+33' }, DE: { national: 10, cc: '+49' }, IT: { national: 10, cc: '+39' },
  ES: { national: 9, cc: '+34' }, NL: { national: 9, cc: '+31' }, BE: { national: 9, cc: '+32' },
};
const DEFAULT_MAX = 16;

const CUSTOM_PHONE_INPUT = React.forwardRef(({ ...rest }, ref) => (
  <input ref={ref} {...rest} className="input-field pl-14 text-base" />
));

export default function PhoneField({ value, onChange, error, defaultCountry, placeholder = '+xxx xxxxxxxx', autoFocus, id }) {
  const [country, setCountry] = useState(defaultCountry);
  const info = COUNTRY_INFO[country];
  const maxLength = info ? info.cc.length + info.national + 5 : DEFAULT_MAX;
  return (
    <div>
      <PhoneInput
        international
        countrySelectProps={{ className: '!absolute !left-0 !top-0 !h-full !w-auto !z-10 !opacity-0 !cursor-pointer' }}
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        onCountryChange={setCountry}
        inputComponent={CUSTOM_PHONE_INPUT}
        placeholder={placeholder}
        autoFocus={autoFocus}
        id={id}
        maxLength={maxLength}
        className="relative"
        smartCaret
      />
      <style>{`
        .PhoneInput { position: relative; }
        .PhoneInput .PhoneInputCountry { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; padding-left: 10px; z-index: 1; pointer-events: none; }
        .PhoneInput .PhoneInputCountrySelect { position: absolute; left: 0; top: 0; height: 100%; width: 60px; opacity: 0; cursor: pointer; z-index: 2; }
        .PhoneInput .PhoneInputCountryIcon { width: 22px; height: 16px; }
        .PhoneInput .PhoneInputCountryIcon--border { box-shadow: 0 0 0 1px rgba(0,0,0,0.1); border-radius: 2px; }
        .PhoneInput .PhoneInputCountrySelectArrow { display: none; }
      `}</style>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function detectBrowserCountry() {
  try {
    const lang = navigator.language || navigator.languages?.[0] || '';
    const parts = lang.split('-');
    if (parts.length > 1 && parts[1].length === 2) return parts[1].toUpperCase();
  } catch {}
  return null;
}

const STORAGE_KEY = 'preferred_country';

export function getInitialCountry(tenantCountry, systemCountryCode) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  if (tenantCountry) return tenantCountry;
  if (systemCountryCode) {
    const ccMap = { '+965': 'KW', '+966': 'SA', '+971': 'AE', '+20': 'EG', '+974': 'QA', '+973': 'BH', '+968': 'OM', '+1': 'US', '+44': 'GB', '+91': 'IN', '+92': 'PK', '+880': 'BD' };
    for (const [code, country] of Object.entries(ccMap)) {
      if (systemCountryCode.startsWith(code)) return country;
    }
  }
  return detectBrowserCountry() || 'KW';
}

export { isValidPhoneNumber };
