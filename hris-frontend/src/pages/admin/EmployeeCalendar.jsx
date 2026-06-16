import React, { useState, useEffect, useCallback, useRef } from 'react';
import { hrService } from '../../services/hr.service';
import SearchableSelect from '../../components/SearchableSelect';

const COLORS = {
  present: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  absent:  { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  sick:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  annual:  { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  casual:  { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  unpaid:  { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  weekend: { bg: 'bg-red-50',     text: 'text-red-400',     dot: 'bg-red-300' },
};

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Tooltip = ({ day, rect }) => {
  if (!day || !rect) return null;
  const tipLeft = Math.min(rect.left, window.innerWidth - 200);
  const tipTop = rect.top - 60;
  return (
    <div className="fixed z-50 pointer-events-none" style={{ left: tipLeft, top: tipTop }}>
      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
        {day.type === 'idle' ? (
          'Idle'
        ) : (
          <>
            <div className="font-medium">{day.label}</div>
            {day.hours != null && day.hours > 0 && <div className="text-gray-300 mt-0.5">{day.hours}h worked</div>}
          </>
        )}
        <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 rotate-45" />
      </div>
    </div>
  );
};

const EmployeeCalendar = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [clockInVal, setClockInVal] = useState('09:00');
  const [clockOutVal, setClockOutVal] = useState('18:00');
  const [totalHoursVal, setTotalHoursVal] = useState(9);
  const [lastEdited, setLastEdited] = useState('clockIn');
  const [modalMsg, setModalMsg] = useState('');
  const [tooltip, setTooltip] = useState(null);
  const cellRefs = useRef({});
  const [weekendDays, setWeekendDays] = useState([0]);

  useEffect(() => {
    hrService.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month, year };
      if (selectedEmployee) params.employeeId = selectedEmployee;
      const data = await hrService.getEmployeeCalendar(params);
      setCalendarData(data);
      if (data.weekendDays) setWeekendDays(data.weekendDays);
    } catch (err) {
      console.error('Calendar fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [month, year, selectedEmployee]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const daysInMonth = new Date(year, month, 0).getDate();

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fmtClock = (d) => {
    if (!d) return '09:00';
    if (typeof d === 'string') return d;
    if (d instanceof Date) return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return '09:00';
  };

  const openDay = (employee, day) => {
    setSelectedDay({ employee, day });
    const status = day.type === 'idle' || day.type === 'weekend' ? '' : day.type;
    setSelectedStatus(status);
    const ci = day.clockIn ? fmtClock(day.clockIn) : '09:00';
    const co = day.clockOut ? fmtClock(day.clockOut) : '18:00';
    setClockInVal(ci);
    setClockOutVal(co);
    setTotalHoursVal(day.hours && day.hours > 0 ? day.hours : 9);
    setModalMsg('');
  };

  useEffect(() => {
    if (modalMsg?.toLowerCase().includes('success')) {
      const t = setTimeout(() => setSelectedDay(null), 1000);
      return () => clearTimeout(t);
    }
  }, [modalMsg]);

  const recalcClockOut = (clockIn, totalHrs) => {
    if (!clockIn || totalHrs == null) return;
    const [h, m] = clockIn.split(':').map(Number);
    const totalMin = h * 60 + m + totalHrs * 60;
    const outH = Math.floor(totalMin / 60) % 24;
    const outM = Math.round(totalMin % 60);
    setClockOutVal(`${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`);
  };

  const recalcClockIn = (clockOut, totalHrs) => {
    if (!clockOut || totalHrs == null) return;
    const [oh, om] = clockOut.split(':').map(Number);
    const totalMin = (oh * 60 + om) - totalHrs * 60;
    if (totalMin < 0) return;
    const inH = Math.floor(totalMin / 60) % 24;
    const inM = Math.round(totalMin % 60);
    setClockInVal(`${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`);
  };

  const handleSave = async () => {
    if (!selectedDay || selectedDay.day.isWeekend || !selectedStatus) return;
    setSaving(true);
    setModalMsg('');
    try {
      const payload = {
        employeeId: selectedDay.employee.id,
        date: selectedDay.day.date,
        status: selectedStatus,
      };
      if (selectedStatus === 'present') {
        payload.clockIn = clockInVal;
        payload.clockOut = clockOutVal;
      }
      await hrService.adminSetStatus(payload);
      setModalMsg('Saved successfully!');
      fetchCalendar();
    } catch (err) {
      setModalMsg(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleMouseEnter = (empId, dayIdx, day) => {
    if (day.type !== 'weekend') {
      const key = `${empId}-${dayIdx}`;
      const el = cellRefs.current[key];
      if (el) {
        const rect = el.getBoundingClientRect();
        setTooltip({ day, rect });
      }
    }
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h3 className="text-sm md:text-lg font-semibold text-gray-900">Attendance Calendar</h3>
        <div className="flex items-center gap-1.5 md:gap-2">
          <SearchableSelect
            options={[
              { value: '', label: 'All Employees' },
              ...employees.map(emp => ({ value: emp.id, label: `${emp.first_name} ${emp.last_name}` })),
            ]}
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            placeholder="All Employees"
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

      <div className="flex gap-3 md:gap-4 text-xs text-gray-500 overflow-x-auto flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Present</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Absent</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Sick</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Annual</div>
        {weekendDays.map(d => (
          <div key={d} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-300"></span>Weekend ({DAY_SHORT[d]})</div>
        ))}
      </div>

      {loading && <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>}

      {calendarData && calendarData.employees.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 px-2 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[110px] max-w-[130px]">Employee</th>
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
                    <td className="sticky left-0 bg-white z-10 px-2 py-2 whitespace-nowrap border-r border-gray-100 max-w-[130px] truncate">
                      <span className="text-xs font-medium text-gray-800">
                        {emp.employee.firstName} {emp.employee.lastName}
                      </span>
                    </td>
                    {empDays.map((day, idx) => {
                      const isIdle = day.type === 'idle';
                      const isWeekend = day.type === 'weekend';
                      const hasColor = !isIdle && !isWeekend;
                      const isFuture = new Date(day.date) > today;
                      const key = `${emp.employee.id}-${idx}`;
                      return (
                        <td
                          key={idx}
                          ref={el => cellRefs.current[key] = el}
                          className={`px-1 py-1.5 text-center border-b border-gray-50 relative ${
                            isWeekend ? 'bg-red-50/40' : ''
                          } ${
                            !isWeekend && !isFuture ? 'cursor-pointer' : ''
                          } ${
                            hasColor ? COLORS[day.type]?.bg : ''
                          } ${!isWeekend && !isFuture ? 'hover:ring-1 hover:ring-inset hover:ring-indigo-300' : ''}`}
                          onClick={() => !isWeekend && !isFuture && openDay(emp.employee, day)}
                          onMouseEnter={() => !isFuture && handleMouseEnter(emp.employee.id, idx, day)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-semibold leading-tight ${
                              isWeekend ? 'text-red-300' : isIdle ? 'text-gray-300' : COLORS[day.type]?.text || 'text-gray-600'
                            }`}>
                              {new Date(day.date).getDate()}
                            </span>
                            {hasColor && (
                              <span className={`w-2 h-2 rounded-full ${COLORS[day.type]?.dot}`} />
                            )}
                            {day.type === 'present' && day.hours != null && day.hours > 0 && (
                              <span className="text-[10px] text-gray-400 font-medium">{day.hours}h</span>
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
        <div className="text-center text-gray-400 py-8 text-sm">No employees found</div>
      )}

      {tooltip && <Tooltip day={tooltip.day} rect={tooltip.rect} />}

      {selectedDay && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setSelectedDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">Manage Attendance</h4>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-2 mb-5">
              <p className="text-sm text-gray-500">
                Employee:{' '}
                <span className="font-medium text-gray-900">{selectedDay.employee.firstName} {selectedDay.employee.lastName}</span>
              </p>
              <p className="text-sm text-gray-500">
                Date:{' '}
                <span className="font-medium text-gray-900">{selectedDay.day.date}</span>
              </p>
            </div>

            {new Date(selectedDay.day.date) > today ? (
              <div className="py-6 text-center">
                <p className="text-sm text-amber-600 font-medium">Cannot manage attendance for future dates.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">Select status...</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="sick">Sick Leave</option>
                    <option value="annual">Annual Leave</option>
                  </select>
                </div>

                {selectedStatus === 'present' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Clock In</label>
                        <input type="time" value={clockInVal}
                          onFocus={() => setLastEdited('clockIn')}
                          onChange={e => {
                            setClockInVal(e.target.value);
                            recalcClockOut(e.target.value, totalHoursVal);
                          }}
                          className="input-field text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Clock Out</label>
                        <input type="time" value={clockOutVal}
                          onFocus={() => setLastEdited('clockOut')}
                          onChange={e => {
                            setClockOutVal(e.target.value);
                            if (clockInVal && e.target.value) {
                              const [ih, im] = clockInVal.split(':').map(Number);
                              const [oh, om] = e.target.value.split(':').map(Number);
                              const diff = ((oh * 60 + om) - (ih * 60 + im)) / 60;
                              if (diff > 0) setTotalHoursVal(parseFloat(diff.toFixed(1)));
                            }
                          }}
                          className="input-field text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Total Hours</label>
                      <input type="number" step="0.5" min="0.5" max="24"
                        value={totalHoursVal}
                        onFocus={() => setLastEdited('totalHours')}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          setTotalHoursVal(v);
                          if (lastEdited === 'clockOut') {
                            recalcClockIn(clockOutVal, v);
                          } else {
                            recalcClockOut(clockInVal, v);
                          }
                        }}
                        className="input-field text-sm" />
                    </div>
                  </div>
                )}

                {modalMsg && (
                  <div className={`p-3 rounded-lg text-sm ${
                    modalMsg.toLowerCase().includes('success') || modalMsg.toLowerCase().includes('saved')
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {modalMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={saving || !selectedStatus} className="btn-primary flex-1 text-sm">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeCalendar;
