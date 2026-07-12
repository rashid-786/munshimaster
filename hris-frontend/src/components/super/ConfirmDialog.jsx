import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 100);
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const variants = {
    danger: { icon: 'text-red-500 bg-red-100', button: 'bg-red-600 hover:bg-red-700', iconSvg: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
    warning: { icon: 'text-amber-500 bg-amber-100', button: 'bg-amber-600 hover:bg-amber-700', iconSvg: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  };
  const v = variants[variant] || variants.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className={`w-12 h-12 rounded-full ${v.icon} flex items-center justify-center mx-auto mb-4`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={v.iconSvg} />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">{title || 'Are you sure?'}</h3>
          {message && <p className="text-sm text-gray-500">{message}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-white transition-all">Cancel</button>
          <button ref={confirmRef} onClick={onConfirm} disabled={loading}
            className={`text-sm px-5 py-2 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium ${v.button}`}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
