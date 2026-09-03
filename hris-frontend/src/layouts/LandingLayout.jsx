import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

const DEFAULT_HEADER = [
  { label: 'Home', page_slug: 'home' },
  { label: 'Pricing', page_slug: 'pricing' },
  { label: 'Services', page_slug: 'services' },
  { label: 'About', page_slug: 'about' },
];

const SOCIAL_ICONS = {
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
};

const hrefOf = (link) => (link.link_type === 'external' ? link.external_url : `/${link.page_slug}`);

function MenuLink({ link, className, children, onClick }) {
  if (link.link_type === 'external') {
    return (
      <a href={link.external_url} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={`/${link.page_slug}`} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export default function LandingLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cms, setCms] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/public/cms`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCms(data))
      .catch(() => {});
  }, []);

  const header = cms?.header?.length ? cms.header : DEFAULT_HEADER;
  const footer = cms?.footer || [];
  const social = cms?.social || [];
  const copyright = cms?.settings?.footerCopyright || '© 2026 Bahi360. All rights reserved.';
  const logoUrl = cms?.settings?.logoUrl || '/logo.png';
  const footerDescription = cms?.settings?.footerDescription || 'All-in-one business management platform for growing organizations. Streamline payroll, attendance, accounting, and workforce operations.';
  const supportEmail = cms?.settings?.supportEmail || 'support@bahi360.com';
  const whatsappNumber = cms?.settings?.whatsappNumber || '';

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center shrink-0">
              <img src={logoUrl} alt="bahi360" className="h-48 w-auto" />
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {header.map((item) => (
                <MenuLink
                  key={item.label}
                  link={item}
                  className={`text-sm font-medium transition-colors ${
                    isActive(item.page_slug ? `/${item.page_slug}` : item.external_url)
                      ? 'text-indigo-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </MenuLink>
              ))}
              <Link to="/login" className="btn-primary !py-2 !px-5">
                Sign In
              </Link>
            </nav>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-4 space-y-2">
              {header.map((item) => (
                <MenuLink
                  key={item.label}
                  link={item}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.page_slug ? `/${item.page_slug}` : item.external_url)
                      ? 'text-indigo-600 bg-indigo-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </MenuLink>
              ))}
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block text-center btn-primary !py-2.5 mt-3"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main footer content */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 lg:gap-12 pt-12 lg:pt-16 pb-10 lg:pb-12">

            {/* Brand & Contact */}
            <div className="col-span-2 md:col-span-3 lg:col-span-1">
              <p className="text-2xl font-bold tracking-tight">
                <span style={{ color: '#F9FAFB' }}>bahi</span>
                <span style={{ color: '#2FBF71' }}>360</span>
              </p>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                {footerDescription}
              </p>
              <div className="mt-5 space-y-2">
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span>{supportEmail}</span>
                </a>
                {whatsappNumber && (
                  <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    <span>Chat on WhatsApp</span>
                  </a>
                )}
              </div>
            </div>

            {/* Dynamic footer categories */}
            {footer.map((cat) => (
              <div key={cat.id}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">{cat.title}</h4>
                <ul className="space-y-3">
                  {cat.links.map((link) => (
                    <li key={link.label}>
                      <MenuLink link={link} className="text-sm text-gray-400 hover:text-white transition-colors">
                        {link.label}
                      </MenuLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          </div>

          {/* Bottom bar */}
          <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">{copyright}</p>
            <div className="flex items-center gap-5">
              {social.map((s) => (
                SOCIAL_ICONS[s.platform] ? (
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors" aria-label={s.platform}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={SOCIAL_ICONS[s.platform]} /></svg>
                  </a>
                ) : null
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}