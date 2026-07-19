import React, { useState, useRef, useEffect } from 'react';

export default function DateRangePicker({ start, end, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const label = start && end ? `${start}  →  ${end}` : 'Select date range';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-field text-sm flex items-center gap-2 min-w-[210px] justify-between"
      >
        <span className={start && end ? 'text-gray-900' : 'text-gray-400'}>{label}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex flex-col gap-2.5 w-[260px]">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-9 shrink-0">From</label>
            <input
              type="date"
              value={start || ''}
              max={end || undefined}
              onChange={e => onChange(e.target.value, end)}
              className="input-field text-sm w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 w-9 shrink-0">To</label>
            <input
              type="date"
              value={end || ''}
              min={start || undefined}
              onChange={e => onChange(start, e.target.value)}
              className="input-field text-sm w-full"
            />
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              onClick={() => onChange('', '')}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary !py-1 !px-3 text-xs"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
