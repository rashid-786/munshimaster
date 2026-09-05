import React, { useState, useEffect } from 'react';
import Drawer from './Drawer';
import Loading from './Loading';
import { hrService } from '../services/hr.service';
import { formatINR } from '../utils/currency';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function DayCell({ day, hourly, onSelect, weekendDays, selected }) {
  const dt = new Date(day.date + 'T00:00:00');
  const dow = dt.getDay();
  const weekend = (weekendDays || []).includes(dow);
  const type = day.type;
  const paid = day.paid || day.type === 'paid';
  const absent = type === 'absent';
  const leave = ['sick', 'annual', 'casual', 'unpaid'].includes(type);
  const idle = type === 'idle' || type === 'none';
  const future = day.date && day.date > new Date().toISOString().slice(0, 10);

  let dot = 'bg-gray-300';
  let cellBg = 'bg-gray-50';
  let border = 'border-gray-200';
  let dayNumCls = 'text-gray-500';
  let sub = null;
  let subCls = '';
  if (hourly) {
    if (weekend) { dot = 'bg-red-300'; cellBg = 'bg-red-50'; border = 'border-red-100'; dayNumCls = 'text-red-400'; }
    else if (type === 'present') { dot = paid ? 'bg-emerald-500' : 'bg-amber-500'; cellBg = paid ? 'bg-emerald-100' : 'bg-amber-100'; border = paid ? 'border-emerald-200' : 'border-amber-200'; dayNumCls = 'text-gray-700'; }
    else if (absent) { dot = 'bg-rose-500'; cellBg = 'bg-rose-100'; border = 'border-rose-200'; dayNumCls = 'text-gray-700'; sub = 'Absent'; subCls = 'text-rose-600'; }
    else if (leave) { dot = 'bg-amber-500'; cellBg = 'bg-amber-100'; border = 'border-amber-200'; dayNumCls = 'text-gray-700'; }
    else { cellBg = 'bg-gray-50'; border = 'border-gray-200'; dot = 'bg-gray-300'; dayNumCls = 'text-gray-500'; }
    if (sub == null) {
      sub = day.hours != null && day.hours > 0 ? day.hours : null;
      subCls = paid ? 'text-emerald-700' : sub != null ? 'text-amber-700' : '';
    }
  } else {
    if (type === 'paid') { dot = 'bg-emerald-500'; cellBg = 'bg-emerald-100'; border = 'border-emerald-200'; dayNumCls = 'text-gray-700'; }
    else if (type === 'unpaid') { dot = 'bg-amber-500'; cellBg = 'bg-amber-100'; border = 'border-amber-200'; dayNumCls = 'text-gray-700'; }
    else if (absent) { dot = 'bg-rose-500'; cellBg = 'bg-rose-100'; border = 'border-rose-200'; dayNumCls = 'text-gray-700'; sub = 'Absent'; subCls = 'text-rose-600'; }
    else { cellBg = 'bg-gray-50'; border = 'border-gray-200'; dot = 'bg-gray-300'; dayNumCls = 'text-gray-500'; }
    if (sub == null) {
      sub = day.totalQuantity && day.totalQuantity > 0 ? day.totalQuantity : null;
      subCls = paid ? 'text-emerald-700' : sub != null ? 'text-amber-700' : '';
    }
  }

  // Item details only for cells with actual piece-work entries (not absent/idle).
  const clickable = !hourly && !absent && !idle && day.entries?.length > 0;
  const Tag = clickable ? 'button' : 'div';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={clickable ? () => onSelect?.(day) : undefined}
      style={selected ? { borderWidth: 2, borderColor: '#4f46e5' } : undefined}
      className={`${cellBg} border ${border} rounded-md p-1 flex flex-col items-center transition-colors ${future ? 'opacity-55' : ''} ${clickable ? 'cursor-pointer hover:border-indigo-400' : ''}`}
      title={clickable ? 'View day items' : undefined}
    >
      <span className={`text-[9px] font-medium ${weekend ? 'text-red-400' : idle ? 'text-gray-400' : 'text-gray-300'}`}>{DOW[dow]}</span>
      <span className={`text-xs font-semibold ${dayNumCls}`}>{dt.getDate()}</span>
      <span className={`w-2.5 h-2.5 rounded-full mt-0.5 border border-black/10 ${dot}`} />
      {sub != null && <span className={`text-[9px] font-semibold mt-0.5 ${subCls}`}>{sub}{!absent && !hourly ? '' : hourly && !absent ? 'h' : ''}</span>}
    </Tag>
  );
}

export default function StaffCalendarDrawer({ open, onClose, employee, startDate, endDate }) {
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [weekendDays, setWeekendDays] = useState([]);
  const hourly = employee?.salaryType !== 'piece';
  const rateRs = Number(employee?.hourlyRate || 0) / 100;

  useEffect(() => {
    if (!open) return;
    let active = true;
    hrService.getTenantSettings()
      .then((res) => {
        if (!active) return;
        // Respect configured weekend days exactly; an empty array means NO weekends.
        const wd = res?.settings?.weekendDays;
        setWeekendDays(Array.isArray(wd) ? wd : [0]);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open || !employee?.employeeId) return;
    let active = true;
    setLoading(true);
    setDays([]);
    setSelectedDay(null);
    const req = hourly
      ? hrService.getEmployeeCalendar({ start: startDate, end: endDate, employeeId: employee.employeeId })
      : hrService.getPieceWorkCalendarData({ start: startDate, end: endDate, employeeId: employee.employeeId });
    req.then((res) => {
      if (!active) return;
      const emp = (res?.employees || [])[0];
      setDays(emp?.days || []);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, employee, startDate, endDate, hourly]);

  const stats = React.useMemo(() => {
    let total = 0, paid = 0, due = 0, paidAmtCents = 0, dueAmtCents = 0;
    const rateCents = Number(employee?.hourlyRate || 0);
    for (const d of days) {
      if (hourly) {
        const h = parseFloat(d.hours || 0);
        total += h;
        if (d.paid) { paid += h; paidAmtCents += h * rateCents; } else { due += h; dueAmtCents += h * rateCents; }
      } else {
        const q = parseFloat(d.totalQuantity || 0);
        total += q;
        if (d.type === 'paid') { paid += q; paidAmtCents += parseInt(d.totalAmount || 0); }
        else if (d.type === 'unpaid') { due += q; dueAmtCents += parseInt(d.totalAmount || 0); }
      }
    }
    return { total, paid, due, paidAmtCents, dueAmtCents };
  }, [days, hourly, employee]);

  const rangeLabel = startDate && endDate && startDate !== endDate ? `${startDate} → ${endDate}` : (startDate || endDate || 'Selected Period');

  return (
    <Drawer open={open} onClose={onClose} title={`${employee?.name || 'Staff'} — ${hourly ? 'Hourly Attendance' : 'Piece Work'} Calendar`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <span className="text-sm font-semibold text-gray-700">{rangeLabel}</span>
        <div className="flex items-center gap-2">
          {hourly && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold">
              ₹{rateRs.toFixed(2)}/hr
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> {hourly ? 'Hourly Worker' : 'Piece Worker'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">{hourly ? 'Total Hours' : 'Total Qty'}</p>
          <p className="text-xl font-bold text-indigo-600 mt-0.5">{stats.total.toFixed(hourly ? 1 : 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.paid.toFixed(hourly ? 1 : 0)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">{hourly ? 'Unpaid Hours' : 'Unpaid Qty'}</p>
          <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.due.toFixed(hourly ? 1 : 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-700">Paid Amount</span>
          <span className="text-base font-bold text-emerald-700">{formatINR(stats.paidAmtCents)}</span>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-indigo-700">Unpaid Amount</span>
          <span className="text-base font-bold text-indigo-700">{formatINR(stats.dueAmtCents)}</span>
        </div>
        <div className="col-span-2 rounded-xl border border-orange-100 bg-orange-50/50 p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-orange-700">Adv. Amount Deducted</span>
          <span className="text-base font-bold text-orange-700">{formatINR(Number(employee?.advanceDeduction || 0))}</span>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : days.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No calendar data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
            {days.map((day, i) => <DayCell key={day.date || i} day={day} hourly={hourly} onSelect={setSelectedDay} weekendDays={weekendDays} selected={!!selectedDay && selectedDay.date === day.date} />)}
          </div>
        </div>
      )}

      {!hourly && selectedDay && selectedDay.entries?.length > 0 && (
        <div className="mt-5 rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">
              Items · {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN')}
            </h4>
            <button onClick={() => setSelectedDay(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 text-xs font-medium" aria-label="Close items">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 px-4 py-3 border-b border-gray-100 bg-white">
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Qty</p>
              <p className="text-base font-bold text-gray-800">
                {selectedDay.entries.reduce((s, e) => s + parseFloat(e.quantity || 0), 0)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Amount</p>
              <p className="text-base font-bold text-indigo-600">
                {formatINR(selectedDay.entries.reduce((s, e) => s + parseInt(e.calculatedAmount || 0, 10), 0))}
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {selectedDay.entries.map((e, idx) => (
              <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{e.workType || '—'}</p>
                  <p className="text-xs text-gray-500">{e.quantity || 0} {e.unitLabel || 'pcs'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">₹{Number(e.ratePerPiece || 0).toFixed(2)}/pc</p>
                  <p className="font-semibold text-gray-900">{formatINR(e.calculatedAmount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Paid</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />{hourly ? 'Unpaid' : 'Unpaid Qty'}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />Absent</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-200" />Weekend</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200" />No Entry</span>
      </div>
    </Drawer>
  );
}
