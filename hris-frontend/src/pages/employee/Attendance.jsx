import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COLORS = {
  present: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  absent:  { bg: 'bg-red-100',     text: 'text-red-800',     dot: 'bg-red-500' },
  sick:    { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  annual:  { bg: 'bg-blue-100',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  casual:  { bg: 'bg-purple-100',  text: 'text-purple-800',  dot: 'bg-purple-500' },
  unpaid:  { bg: 'bg-orange-100',  text: 'text-orange-800',  dot: 'bg-orange-500' },
  weekend: { bg: 'bg-red-50',      text: 'text-red-400',     dot: 'bg-red-300' },
};

const Attendance = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weekendDays, setWeekendDays] = useState([0]);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const data = await hrService.getEmployeeCalendar({ month, year });
      setCalendarData(data);
      if (data.weekendDays) setWeekendDays(data.weekendDays);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCalendar(); }, [month, year]);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [month, year]);

  const dayHeaders = useMemo(() => {
    const headers = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      headers.push({ day: d, dow, isWeekend: weekendDays.includes(dow) });
    }
    return headers;
  }, [daysInMonth, month, year, weekendDays]);

  const myDays = useMemo(() => {
    if (!calendarData || !calendarData.employees || calendarData.employees.length === 0) return [];
    return calendarData.employees[0].days || [];
  }, [calendarData]);

  const stats = useMemo(() => {
    let present = 0, absent = 0, onLeave = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const day of myDays) {
      if (new Date(day.date) > today) continue;
      if (day.isWeekend) continue;
      if (day.type === 'present') present++;
      else if (day.type === 'absent') absent++;
      else if (day.type === 'sick' || day.type === 'annual' || day.type === 'casual' || day.type === 'unpaid') onLeave++;
    }
    return { present, absent, onLeave };
  }, [myDays]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">My Attendance</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-secondary text-sm px-2 py-1">&larr;</button>
          <span className="text-sm font-semibold text-gray-800 min-w-[100px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="btn-secondary text-sm px-2 py-1">&rarr;</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
          <p className="text-sm text-gray-500 mt-1">Days Present</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
          <p className="text-sm text-gray-500 mt-1">Days Absent</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.onLeave}</p>
          <p className="text-sm text-gray-500 mt-1">Days on Leave</p>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Present</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>Absent</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Sick</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Annual</div>
        {weekendDays.map(d => (
          <div key={d} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-300"></span>Weekend ({DAYS_SHORT[d]})</div>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8 text-sm">Loading...</div>
      ) : myDays.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full" style={{ minWidth: 400 }}>
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">Date</th>
                {dayHeaders.map(h => (
                  <th key={h.day} className={`px-1 py-1.5 text-center border-b border-gray-200 w-[34px] ${h.isWeekend ? 'bg-red-50' : ''}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${h.isWeekend ? 'text-red-400' : 'text-gray-400'}`}>
                      {DAYS_SHORT[h.dow]}
                    </div>
                    <div className={`text-xs font-bold mt-0.5 ${h.isWeekend ? 'text-red-500' : 'text-gray-700'}`}>
                      {h.day}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-gray-50/50 transition-colors">
                <td className="sticky left-0 bg-white z-10 px-3 py-2 whitespace-nowrap border-r border-gray-100 text-sm font-medium text-gray-800">
                  Your Days
                </td>
                {myDays.map((day, idx) => {
                  const isIdle = day.type === 'idle';
                  const isWeekend = day.type === 'weekend';
                  const hasColor = !isIdle && !isWeekend;
                  return (
                    <td
                      key={idx}
                      className={`px-0.5 py-1 text-center border-b border-gray-50 ${
                        isWeekend ? 'bg-red-50/40' : ''
                      } ${hasColor ? COLORS[day.type]?.bg : ''}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[11px] font-medium leading-tight ${
                          isWeekend ? 'text-red-300' : isIdle ? 'text-gray-300' : COLORS[day.type]?.text || 'text-gray-600'
                        }`}>
                          {new Date(day.date).getDate()}
                        </span>
                        {hasColor && (
                          <span className={`w-1.5 h-1.5 rounded-full ${COLORS[day.type]?.dot}`} />
                        )}
                        {day.type === 'present' && day.hours != null && day.hours > 0 && (
                          <span className="text-[9px] text-gray-400">{day.hours}h</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8 text-sm">No attendance records found</div>
      )}
    </div>
  );
};

export default Attendance;
