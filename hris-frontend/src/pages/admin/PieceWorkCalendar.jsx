import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../context/AuthContext';
import SearchableSelect from '../../components/SearchableSelect';
import Loading from '../../components/Loading';
import { formatINR } from '../../utils/currency';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COLORS = {
  paid:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  unpaid:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-orange-500' },
  none:    { bg: 'bg-white',      text: 'text-gray-300',    dot: 'bg-gray-200' },
};

const Tooltip = ({ day, rect }) => {
  if (!day || !rect) return null;
  const tipLeft = Math.min(rect.left, window.innerWidth - 200);
  const tipTop = rect.top - 60;
  return (
    <div className="fixed z-50 pointer-events-none" style={{ left: tipLeft, top: tipTop }}>
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
        {day.type === 'none' ? (
          'No Entry'
        ) : (
          <>
            <div className="text-gray-300">Amount: {formatINR(day.totalAmt)} ({day.isPaid ? 'Paid' : 'Unpaid'})</div>
          </>
        )}
      </div>
      <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
    </div>
  );
};

const PieceWorkCalendar = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [tooltip, setTooltip] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dayEntries, setDayEntries] = useState([]);
  const [weekendDays, setWeekendDays] = useState([0]);

  const cellRefs = useRef({});

  useEffect(() => {
    hrService.getEmployees().then(setEmployees).catch(() => {});
    hrService.getTenantSettings().then(res => {
      if (res.settings?.weekendDays) setWeekendDays(res.settings.weekendDays);
    }).catch(() => {});
  }, [tenant?.id]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const params = { month, year };
        if (selectedEmployee) params.employeeId = selectedEmployee;
        const data = await hrService.getPieceWorkCalendarData(params);
        if (ignore) return;
        setCalendarData(data);
      } catch (err) {
        if (!ignore) console.error('Piece work calendar fetch failed:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [month, year, selectedEmployee, refreshKey]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const dayHeaders = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    dayHeaders.push({ day: d, dow, isWeekend: weekendDays.includes(dow) });
  }

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const openDay = async (employee, day) => {
    setSelectedDay({ employee, day });
    setModalMsg('');
    // fetch piece rates for this employee
    let rates = [];
    try {
      rates = await hrService.getEmployeePieceRates({ employeeId: employee.id });
    } catch (_) {}
    // if there are existing entries for this day, merge with rates
    if (day.entries && day.entries.length > 0) {
      setDayEntries(day.entries.map(e => ({
        id: e.id,
        workType: e.workType || '',
        unitLabel: e.unitLabel || 'pcs',
        ratePerPiece: e.ratePerPiece !== undefined ? String((e.ratePerPiece / 100).toFixed(2)) : '',
        quantity: e.quantity !== undefined ? String(e.quantity) : '',
        calculatedAmount: e.calculatedAmount || 0,
        isPaid: e.isPaid,
      })));
    } else if (rates.length > 0) {
      // auto-populate from configured piece rates
      setDayEntries(rates.map(r => ({
        workType: r.work_type || '',
        unitLabel: r.unit_label || 'pcs',
        ratePerPiece: r.rate_per_piece ? String((r.rate_per_piece / 100).toFixed(2)) : '',
        quantity: '',
        calculatedAmount: 0,
      })));
    } else {
      setDayEntries([{ workType: '', unitLabel: 'pcs', ratePerPiece: '', quantity: '', calculatedAmount: 0 }]);
    }
  };

  const closeDay = useCallback(() => {
    setSelectedDay(null);
    setDayEntries([]);
    setModalMsg('');
  }, []);

  const sanitizeDecimal = (v) => {
    let s = v.replace(/[^0-9.]/g, '');
    const dot = s.indexOf('.');
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
    return s;
  };

  const handleQtyChange = (idx, value) => {
    const sanitized = sanitizeDecimal(value);
    setDayEntries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: sanitized };
      const qty = parseFloat(sanitized) || 0;
      const rate = parseFloat(next[idx].ratePerPiece) || 0;
      next[idx].calculatedAmount = Math.round(qty * rate * 100);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedDay) return;
    const validEntries = dayEntries.filter(e => e.workType && parseFloat(e.quantity) > 0);
    if (validEntries.length === 0) {
      setModalMsg('Add at least one work type with quantity.');
      return;
    }
    setSaving(true);
    setModalMsg('');
    try {
      await hrService.savePieceWorkDayEntries({
        employeeId: selectedDay.employee.id,
        date: selectedDay.day.date,
        entries: validEntries.map(e => ({
          workType: e.workType,
          unitLabel: e.unitLabel || 'pcs',
          ratePerPiece: parseFloat(e.ratePerPiece) || 0,
          quantity: parseFloat(e.quantity) || 0,
        })),
      });
      setModalMsg('Saved successfully!');
      setRefreshKey(k => k + 1);
    } catch (err) {
      setModalMsg(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-close modal on success
  useEffect(() => {
    if (modalMsg?.toLowerCase().includes('success')) {
      const t = setTimeout(() => closeDay(), 1200);
      return () => clearTimeout(t);
    }
  }, [modalMsg, closeDay]);

  const pieceEmployees = useMemo(() =>
    employees.filter(e => e.salary_type === 'piece' && e.status === 'active'),
    [employees]
  );

  const stats = useMemo(() => {
    if (!calendarData) return { totalWorkers: 0, totalDue: 0, totalPaid: 0, totalQty: 0 };
    const totalWorkers = calendarData.employees.length;
    let totalDue = 0, totalPaid = 0, totalQty = 0;
    for (const emp of calendarData.employees) {
      for (const day of emp.days) {
        if (day.type !== 'none') totalQty += day.totalQuantity;
        if (day.type === 'paid') totalPaid += day.totalAmount;
        else if (day.type !== 'none') totalDue += day.totalAmount;
      }
    }
    return { totalWorkers, totalDue, totalPaid, totalQty };
  }, [calendarData]);

  const handleMouseEnter = (empId, dayIdx, day) => {
    const key = `${empId}-${dayIdx}`;
    const el = cellRefs.current[key];
    if (el) {
      const rect = el.getBoundingClientRect();
      const label = `${day.date}`;
      setTooltip({ day: { ...day, label, totalQty: day.totalQuantity, totalAmt: day.totalAmount }, rect });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h3 className="text-sm md:text-lg font-semibold text-gray-900">Piece Work Calendar</h3>
        <div className="flex items-center gap-1.5 md:gap-2">
          <SearchableSelect
            options={[
              { value: '', label: 'All Piece Workers' },
              ...pieceEmployees.map(emp => ({ value: emp.id, label: `${emp.first_name} ${emp.last_name}` })),
            ]}
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            placeholder="All Piece Workers"
            className="w-[180px]"
          />
          <div className="flex items-center gap-1 ml-auto md:ml-0">
            <button onClick={prevMonth} className="btn-secondary text-xs md:text-sm px-1.5 md:px-2.5 py-1 md:py-1.5">&larr;</button>
            <h4 className="text-xs md:text-base font-semibold text-gray-800 text-nowrap">
              {new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })}
            </h4>
            <button onClick={nextMonth} className="btn-secondary text-xs md:text-sm px-1.5 md:px-2.5 py-1 md:py-1.5">&rarr;</button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 md:gap-4 text-xs text-gray-500 overflow-x-auto flex-wrap items-center">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Paid</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>Unpaid</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200"></span>No Entry</div>
        {weekendDays.map(d => (
          <div key={d} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-300"></span>{DAY_SHORT[d]}</div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Piece Workers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalWorkers}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Qty</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.totalQty}</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/payroll')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Due Amount</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(stats.totalDue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Paid Amount</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(stats.totalPaid)}</p>
        </div>
      </div>

      {/* Calendar Table */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-xl">
            <Loading />
          </div>
        )}

        {calendarData && calendarData.employees.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white z-10 px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[110px] max-w-[130px]">Worker</th>
                  {dayHeaders.map(h => (
                    <th
                      key={h.day}
                      className={`px-1.5 py-2 text-center border-b border-gray-200 w-[42px] ${h.isWeekend ? 'bg-red-50' : ''}`}
                    >
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${h.isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                        {DAY_SHORT[h.dow]}
                      </div>
                      <div className={`text-sm font-bold mt-0.5 ${h.isWeekend ? 'text-red-500' : 'text-gray-700'}`}>
                        {h.day}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calendarData.employees.map(emp => {
                  const empDays = emp.days || [];
                  return (
                    <tr key={emp.employee.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="sticky left-0 bg-white z-10 px-2 py-2 whitespace-nowrap border-r border-gray-100 max-w-[140px]">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-800">
                            {emp.employee.firstName} {emp.employee.lastName}
                          </span>
                          {empDays.some(d => d.type !== 'none') && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              {empDays.reduce((s, d) => s + (d.type !== 'none' && d.type !== 'paid' ? d.totalQuantity : 0), 0)} due · {formatINR(empDays.reduce((s, d) => s + (d.type !== 'none' && d.type !== 'paid' ? d.totalAmount : 0), 0))}
                            </span>
                          )}
                        </div>
                      </td>
                      {empDays.map((day, idx) => {
                        const isNone = day.type === 'none';
                        const isFuture = day.date > todayStr;
                        const isWeekend = dayHeaders[idx]?.isWeekend;
                        const key = `${emp.employee.id}-${idx}`;
                        const color = isWeekend ? null : (COLORS[day.type] || COLORS.none);
                        return (
                          <td
                            key={idx}
                            ref={el => cellRefs.current[key] = el}
                            className={`px-1 py-1.5 text-center border-b border-gray-50 relative ${
                              isWeekend ? 'bg-red-50/40' : ''
                            } ${
                              !isFuture && !isWeekend ? 'cursor-pointer' : ''
                            } ${
                              color?.bg || ''
                            } ${!isFuture && !isWeekend ? 'hover:ring-1 hover:ring-inset hover:ring-indigo-300' : ''}`}
                            onClick={() => !isFuture && !isWeekend && openDay(emp.employee, day)}
                            onMouseEnter={() => handleMouseEnter(emp.employee.id, idx, day)}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-xs font-semibold leading-tight ${
                                isWeekend ? 'text-red-300' : color?.text || 'text-gray-300'
                              }`}>
                                {new Date(day.date).getDate()}
                              </span>
                              {!isNone && !isWeekend && (
                                <span className={`w-2 h-2 rounded-full ${color?.dot || 'bg-gray-200'}`} />
                              )}

                              {day.type === 'unpaid' && (
                                <span className="text-[9px] font-semibold text-amber-700">{day.totalQuantity} Qty</span>
                              )}

                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {calendarData && calendarData.employees.length === 0 && (
          <div className="text-center text-gray-400 py-8 text-sm">No piece workers found</div>
        )}
      </div>

      {tooltip && <Tooltip day={tooltip.day} rect={tooltip.rect} />}

      {/* Entry Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/20 flex items-start justify-center z-50 pt-10 md:pt-20">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Piece Work Entry</h4>
                <p className="text-sm text-gray-500 mt-0.5">
                  {selectedDay.employee.firstName} {selectedDay.employee.lastName} &middot; {selectedDay.day.date}
                </p>
              </div>
              <button onClick={closeDay} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {selectedDay.day.date > todayStr ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-amber-600 font-medium">Cannot enter piece work for future dates.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider w-8">#</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Work Type</th>
                          <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Unit</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Rate</th>
                          <th className="text-center px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Qty Produced</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dayEntries.map((entry, i) => {
                          const isPaid = entry.isPaid === 1 || entry.isPaid === '1';
                          return (
                            <tr key={i} className={isPaid ? 'opacity-60' : ''}>
                              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 font-medium">{entry.workType || '—'}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{entry.unitLabel || 'pcs'}</td>
                              <td className="px-3 py-2 text-sm text-gray-700 text-right font-medium">
                                {entry.ratePerPiece ? `${localStorage.getItem('currency_symbol') || '₹'}${entry.ratePerPiece}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={entry.quantity}
                                  onChange={e => handleQtyChange(i, e.target.value)}
                                  className="input-field !py-1 text-sm text-center font-medium w-20 mx-auto"
                                  placeholder="0"
                                  disabled={isPaid}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                {formatINR(entry.calculatedAmount || 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">
                        Total Quantity: <span className="font-semibold text-gray-900">
                          {dayEntries.reduce((s, e) => s + (parseFloat(e.quantity) || 0), 0)}
                        </span>
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">
                      Total Amount: <span className="font-semibold text-gray-900">
                        {formatINR(dayEntries.reduce((s, e) => s + (e.calculatedAmount || 0), 0))}
                      </span>
                    </p>
                  </div>

                  {modalMsg && (
                    <div className={`p-3 rounded-lg text-sm ${
                      modalMsg.toLowerCase().includes('success') || modalMsg.toLowerCase().includes('saved')
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {modalMsg}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedDay.day.date <= todayStr && !dayEntries.some(e => e.isPaid === 1 || e.isPaid === '1') && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Saving...' : 'Save Entries'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PieceWorkCalendar;
