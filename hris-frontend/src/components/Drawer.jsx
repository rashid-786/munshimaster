import { useEffect } from 'react';

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative bg-white shadow-2xl w-full max-w-full lg:max-w-3xl xl:max-w-4xl h-full flex flex-col animate-slide-in-right">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-lg leading-none">&times;</button>
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
    </div>
  );
}
