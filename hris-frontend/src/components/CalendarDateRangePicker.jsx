import React, { useState } from 'react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const parseKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  return { y, m, d };
};
const dateKey = (dt) => toKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
const isSameOrBetween = (key, a, b) => {
  if (!a || !b) return false;
  return (a <= key && key <= b) || (b <= key && key <= a);
};

export default function CalendarDateRangePicker({ start, end, onChange, maxDate }) {
  const today = maxDate || dateKey(new Date());
  const todayP = parseKey(today);

  const initialM = start ? parseKey(start).m : todayP.m;
  const initialY = start ? parseKey(start).y : todayP.y;
  const [month, setMonth] = useState(initialM);
  const [year, setYear] = useState(initialY);

  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7; // Monday-start index
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ d });

  const handlePick = (day) => {
    const key = toKey(year, month, day);
    if (key > today) return;
    if (!start || (start && end)) {
      onChange(key, '');
      return;
    }
    if (key < start) {
      onChange(key, '');
      return;
    }
    onChange(start, key);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); } else { setMonth(month - 1); }
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); } else { setMonth(month + 1); }
  };

  const canGoNext = (() => {
    if (year < todayP.y) return true;
    if (year === todayP.y && month < todayP.m) return true;
    return false;
  })();

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-[300px]">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">{MONTHS[month - 1]} {year}</span>
        <button type="button" onClick={nextMonth} disabled={!canGoNext} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[10px] font-semibold text-gray-400 uppercase">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />;
          const key = toKey(year, month, cell.d);
          const isToday = key === today;
          const isStart = key === start;
          const isEnd = key === end && start !== end;
          const inRange = isSameOrBetween(key, start, end);
          const isPastEnd = key > today;
          const isDisabled = isPastEnd;
          const base = "relative h-8 flex items-center justify-center text-xs rounded-md transition-colors select-none";
          const cellStyle = (() => {
            if (key === start || isEnd) return base + " bg-indigo-600 text-white font-semibold";
            if (inRange && key !== start && key !== end) return base + " bg-indigo-50 text-indigo-700";
            return base + (isDisabled ? " text-gray-300 cursor-not-allowed" : isToday ? " text-indigo-700 font-bold ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50" : " text-gray-700 hover:bg-indigo-50");
          })();
          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => handlePick(cell.d)}
              className={cellStyle}
            >
              {cell.d}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="text-[11px] text-gray-500">
          {start || end ? `${start || '—'}  →  ${end || '…'}` : 'Select From then To'}
        </span>
      </div>
    </div>
  );
}
