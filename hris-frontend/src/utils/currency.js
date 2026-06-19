export function formatINR(cents) {
  return '₹' + Number(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function mixColor(base, target, ratio) {
  return {
    r: base.r + (target.r - base.r) * ratio,
    g: base.g + (target.g - base.g) * ratio,
    b: base.b + (target.b - base.b) * ratio,
  };
}

export function generatePalette(hexColor) {
  const base = hexToRgb(hexColor) || { r: 79, g: 70, b: 229 };
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  return {
    50: rgbToHex(mixColor(white, base, 0.08)),
    100: rgbToHex(mixColor(white, base, 0.20)),
    200: rgbToHex(mixColor(white, base, 0.40)),
    300: rgbToHex(mixColor(white, base, 0.60)),
    400: rgbToHex(mixColor(white, base, 0.80)),
    500: rgbToHex(mixColor(white, base, 0.92)),
    600: hexColor,
    700: rgbToHex(mixColor(base, black, 0.15)),
    800: rgbToHex(mixColor(base, black, 0.30)),
    900: rgbToHex(mixColor(base, black, 0.50)),
  };
}

export function formatPhone(phone) {
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;
  const countryCode = localStorage.getItem('default_country_code') || '+965';
  const digits = phone.replace(/\D/g, '');
  return `${countryCode} ${digits}`;
}

export function applyTheme(hexColor) {
  const palette = generatePalette(hexColor);
  const root = document.documentElement;
  Object.entries(palette).forEach(([shade, color]) => {
    root.style.setProperty(`--primary-${shade}`, color);
  });
  root.style.setProperty('--primary', hexColor);
  root.style.setProperty('--primary-hover', palette[700]);
  root.style.setProperty('--primary-light', palette[50]);
  localStorage.setItem('primary_color', hexColor);
}
