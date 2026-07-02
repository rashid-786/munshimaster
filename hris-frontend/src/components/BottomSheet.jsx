import { useEffect, useRef } from 'react';

export default function BottomSheet({ open, onClose, title, children, actions }) {
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !open) return;

    const onTouchStart = (e) => {
      if (e.target.closest('.bottom-sheet-body')?.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      currentY.current = 0;
      dragging.current = true;
      el.style.transition = 'none';
    };

    const onTouchMove = (e) => {
      if (!dragging.current) return;
      currentY.current = e.touches[0].clientY - startY.current;
      if (currentY.current > 0) {
        el.style.transform = `translateY(${Math.min(currentY.current, 200)}px)`;
      }
    };

    const onTouchEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      el.style.transition = '';
      el.style.transform = '';
      if (currentY.current > 100) onClose();
      currentY.current = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="fixed inset-0 bg-black/40 transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[90dvh] flex flex-col"
      >
        <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bottom-sheet-body flex-1 overflow-y-auto min-h-0 px-5 py-4">
          {children}
        </div>

        {actions && (
          <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-3 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
