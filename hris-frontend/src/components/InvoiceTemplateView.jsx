import { useMemo } from 'react';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function logoFullUrl(url) {
  if (!url) return null;
  const base = VITE_API_BASE_URL;
  if (url.startsWith('http')) return url;
  const clean = url.replace(/^\/api\/v1/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
}

export default function InvoiceTemplateView({ templateConfig, children, className = '' }) {
  const style = useMemo(() => {
    if (!templateConfig) return {};
    const s = templateConfig;
    return {
      '--template-primary': s.primaryColor || '#0F172A',
      '--template-secondary': s.secondaryColor || '#16A34A',
      '--template-font': s.fontFamily || 'inherit',
      '--template-font-size': s.fontSize === 'large' ? '15px' : (s.fontSize === 'medium' ? '14px' : '13px'),
      '--template-heading-size': s.fontSize === 'large' ? '18px' : (s.fontSize === 'medium' ? '16px' : '15px'),
    };
  }, [templateConfig]);

  const s = templateConfig || {};
  const logo = s.logoUrl ? logoFullUrl(s.logoUrl) : null;
  const logoAlign = s.logoAlignment || 'left';
  const companyText = s.companyName || '';

  return (
    <div className={className} style={style}>
      {(logo || companyText) && (
        <div className={`flex items-center gap-4 mb-4 ${logoAlign === 'center' ? 'justify-center' : logoAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
          {logo && (
            <img src={logo} alt="Company logo" className="max-h-16 object-contain"
              onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          {companyText && (
            <h2 className="text-xl font-bold" style={{ color: 'var(--template-primary)', fontFamily: 'var(--template-font)' }}>
              {companyText}
            </h2>
          )}
        </div>
      )}
      <div style={{ fontFamily: 'var(--template-font)', fontSize: 'var(--template-font-size)' }}>
        {children}
      </div>
    </div>
  );
}
