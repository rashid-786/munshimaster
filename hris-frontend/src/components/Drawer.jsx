import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Drawer({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white shadow-2xl w-full max-w-full lg:max-w-3xl xl:max-w-4xl h-full flex flex-col animate-slide-in-right">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
          <button onClick={onClose} className="p-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors shrink-0" aria-label="Close drawer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
