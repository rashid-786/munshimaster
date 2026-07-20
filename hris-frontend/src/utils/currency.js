export function formatINR(cents) {
  const symbol = localStorage.getItem('currency_symbol') || '₹';
  return symbol + Number(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function getLuminance(hex) {
  const c = (hex || '#ffffff').replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const ch = (i) => parseInt(full.substr(i, 2), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(2)) + 0.0722 * lin(ch(4));
}

function sidebarPalette(mode, color) {
  if (mode === 'dark') {
    return {
      isDark: true, bg: '#0f1b2d', text: '#e5e7eb', textMuted: '#94a3b8', textFaint: '#64748b',
      hover: 'rgba(255,255,255,0.06)', activeBg: 'rgba(47,191,113,0.16)', activeText: '#4ade80',
      accent: '#2FBF71', accentBorder: 'rgba(47,191,113,0.5)', border: 'rgba(255,255,255,0.08)',
      headerBg: 'rgba(255,255,255,0.04)',
    };
  }
  if (mode === 'custom') {
    const isDark = getLuminance(color) < 0.5;
    if (isDark) {
      return {
        isDark: true, bg: color, text: '#f1f5f9', textMuted: '#cbd5e1', textFaint: '#94a3b8',
        hover: 'rgba(255,255,255,0.10)', activeBg: 'rgba(255,255,255,0.16)', activeText: '#ffffff',
        accent: '#ffffff', accentBorder: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.12)',
        headerBg: 'rgba(255,255,255,0.06)',
      };
    }
    return {
      isDark: false, bg: color, text: '#374151', textMuted: '#6b7280', textFaint: '#9ca3af',
      hover: 'rgba(0,0,0,0.05)', activeBg: 'rgba(0,0,0,0.06)', activeText: '#0B3C5D',
      accent: '#2FBF71', accentBorder: 'rgba(47,191,113,0.45)', border: 'rgba(0,0,0,0.10)',
      headerBg: 'rgba(0,0,0,0.04)',
    };
  }
  return {
    isDark: false, bg: '#ffffff', text: '#374151', textMuted: '#6b7280', textFaint: '#9ca3af',
    hover: 'rgba(17,24,39,0.04)', activeBg: 'rgba(11,60,93,0.06)', activeText: '#0B3C5D',
    accent: '#2FBF71', accentBorder: 'rgba(47,191,113,0.45)', border: 'rgba(15,23,42,0.08)',
    headerBg: 'linear-gradient(135deg, #f5f8fb 0%, #eef4f8 100%)',
  };
}

export function applySidebarTheme(mode = 'light', color = '#0B3C5D') {
  const theme = sidebarPalette(mode, color);
  const root = document.documentElement;
  const set = (k, v) => root.style.setProperty(k, v);
  set('--sb-bg', theme.bg);
  set('--sb-text', theme.text);
  set('--sb-text-muted', theme.textMuted);
  set('--sb-text-faint', theme.textFaint);
  set('--sb-hover', theme.hover);
  set('--sb-active-bg', theme.activeBg);
  set('--sb-active-text', theme.activeText);
  set('--sb-accent', theme.accent);
  set('--sb-accent-border', theme.accentBorder);
  set('--sb-border', theme.border);
  set('--sb-header-bg', theme.headerBg);
  localStorage.setItem('sidebar_mode', mode);
  localStorage.setItem('sidebar_color', color);
  localStorage.setItem('sidebar_theme', JSON.stringify({ isDark: theme.isDark }));
  window.dispatchEvent(new Event('sidebar-theme-updated'));
}

export function getSidebarTheme() {
  try {
    const raw = localStorage.getItem('sidebar_theme');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { isDark: (localStorage.getItem('sidebar_mode') || 'light') === 'dark' };
}
