import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import Loading from '../../components/Loading';

const HrDashboard = () => {
  const navigate = useNavigate();
  const groupLabels = JSON.parse(localStorage.getItem('group_labels') || '{}');
  const staffLabel = groupLabels['My Staff'] || 'My Staff';
  const [employees, setEmployees] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [pieceCalendarData, setPieceCalendarData] = useState(null);
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const absentTypes = ['absent'];
  const leaveTypes = ['sick', 'annual', 'casual', 'unpaid'];

  useEffect(() => {
    Promise.all([
      hrService.getEmployees().catch(() => []),
      hrService.getEmployeeCalendar({ month: currentMonth, year: currentYear }).catch(() => null),
      hrService.getPayrollHistory().catch(() => []),
      hrService.getPieceWorkCalendarData({ month: currentMonth, year: currentYear }).catch(() => null),
    ]).then(([emps, cal, pay, pCal]) => {
      setEmployees(emps);
      setCalendarData(cal);
      setPayroll(Array.isArray(pay) ? pay : []);
      setPieceCalendarData(pCal);
    }).finally(() => setLoading(false));
  }, []);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const salaryTypeMap = useMemo(() => {
    const map = {};
    for (const emp of employees) map[emp.id] = emp.salary_type || 'fixed';
    return map;
  }, [employees]);

  const totalStaff = employees.length;

  const todayAttendance = useMemo(() => {
    let present = 0, absent = 0, leave = 0;
    if (calendarData) {
      for (const emp of calendarData.employees) {
        if (emp.employee?.salaryType === 'piece') continue;
        for (const day of emp.days) {
          if (day.date === todayStr) {
            if (day.type === 'present') present++;
            else if (absentTypes.includes(day.type)) absent++;
            else if (leaveTypes.includes(day.type)) leave++;
          }
        }
      }
    }
    if (pieceCalendarData) {
      for (const emp of pieceCalendarData.employees) {
        const day = emp.days.find(d => d.date === todayStr);
        if (day && (day.type === 'paid' || day.type === 'unpaid')) present++;
        else if (day && day.type === 'absent') absent++;
      }
    }
    return { present, absent, leave };
  }, [calendarData, pieceCalendarData, todayStr]);

  const monthHoursByEmployee = useMemo(() => {
    const map = {};
    if (!calendarData) return map;
    for (const emp of calendarData.employees) {
      const empId = emp.employee.id;
      map[empId] = emp.days.reduce((sum, d) => sum + parseFloat(d.hours || 0), 0);
    }
    return map;
  }, [calendarData]);

  const monthPayrollByEmployee = useMemo(() => {
    const map = {};
    for (const p of payroll) {
      const endDate = new Date(p.pay_period_end);
      if (endDate.getMonth() + 1 === currentMonth && endDate.getFullYear() === currentYear) {
        const empId = p.employee_id;
        map[empId] = {
          amount: (map[empId]?.amount || 0) + parseFloat(p.net_salary || 0),
          hours: (map[empId]?.hours || 0) + parseFloat(p.total_hours_worked || 0),
          status: p.status === 'paid' ? 'paid' : 'due',
        };
      }
    }
    return map;
  }, [payroll, currentMonth, currentYear]);

  const calendarPayrollByEmployee = useMemo(() => {
    const map = {};
    if (!calendarData) return map;
    for (const emp of calendarData.employees) {
      const empId = emp.employee.id;
      const hours = emp.days.reduce((sum, d) => sum + (d.paid ? 0 : parseFloat(d.hours || 0)), 0);
      const payPerHour = Number(emp.employee.payPerHour || 0);
      map[empId] = { hours, payPerHour, due: hours * payPerHour };
    }
    return map;
  }, [calendarData]);

  const pieceCalendarByEmployee = useMemo(() => {
    const map = {};
    if (!pieceCalendarData) return map;
    for (const emp of pieceCalendarData.employees) {
      const empId = emp.employee.id;
      let unpaidQty = 0, unpaidAmt = 0, paidQty = 0, paidAmt = 0;
      for (const day of emp.days) {
        if (day.type === 'paid') {
          paidQty += day.totalQuantity || 0;
          paidAmt += day.totalAmount || 0;
        } else if (day.type === 'unpaid') {
          unpaidQty += day.totalQuantity || 0;
          unpaidAmt += day.totalAmount || 0;
        }
      }
      map[empId] = { unpaidQty, unpaidAmt, paidQty, paidAmt };
    }
    return map;
  }, [pieceCalendarData]);

  const totalDueAmount = useMemo(() => {
    const hourlyDue = Object.values(calendarPayrollByEmployee).reduce((s, v) => s + v.due, 0);
    const pieceDue = Object.values(pieceCalendarByEmployee).reduce((s, v) => s + v.unpaidAmt, 0);
    return hourlyDue + pieceDue;
  }, [calendarPayrollByEmployee, pieceCalendarByEmployee]);

  const totalPaidAmount = useMemo(() => {
    return payroll
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + parseFloat(p.net_salary || 0), 0);
  }, [payroll]);

  const totalLoggedHours = useMemo(() => {
    return Object.values(monthHoursByEmployee).reduce((s, v) => s + v, 0);
  }, [monthHoursByEmployee]);

  const totalDueHours = useMemo(() => {
    return Object.values(calendarPayrollByEmployee).reduce((s, v) => s + v.hours, 0);
  }, [calendarPayrollByEmployee]);

  const totalPaidHours = useMemo(() => {
    let hours = 0;
    for (const empId in monthPayrollByEmployee) {
      const rec = monthPayrollByEmployee[empId];
      if (rec.status === 'paid' && salaryTypeMap[empId] !== 'piece') hours += rec.hours;
    }
    return hours;
  }, [monthPayrollByEmployee, salaryTypeMap]);

  const totalDueQty = useMemo(() => {
    return Object.values(pieceCalendarByEmployee).reduce((s, v) => s + v.unpaidQty, 0);
  }, [pieceCalendarByEmployee]);

  const totalPaidQty = useMemo(() => {
    let qty = 0;
    for (const empId in monthPayrollByEmployee) {
      const rec = monthPayrollByEmployee[empId];
      const st = salaryTypeMap[empId];
      if (rec.status === 'paid' && st === 'piece') qty += rec.hours;
    }
    return qty;
  }, [monthPayrollByEmployee, salaryTypeMap]);

  const totalLoggedQty = useMemo(() => {
    let total = 0;
    for (const empId in pieceCalendarByEmployee) {
      const rec = pieceCalendarByEmployee[empId];
      total += rec.unpaidQty + rec.paidQty;
    }
    return total;
  }, [pieceCalendarByEmployee]);

  const quickActions = useMemo(() => [
    { label: 'Staff Directory', route: '/admin/employees', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m1-7a3 3 0 11-6 0 3 3 0 016 0z" /></>, desc: 'View & manage all staff members', color: 'from-indigo-500 to-blue-600' },
    { label: 'Attendance', route: '/admin/attendance', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></>, desc: 'Mark daily attendance & view calendar', color: 'from-emerald-500 to-teal-600' },
    { label: 'Leave Approvals', route: '/admin/leaves', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></>, desc: 'Approve or reject leave requests', color: 'from-amber-500 to-orange-600' },
    { label: 'Payroll', route: '/admin/payroll', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></>, desc: 'Run payroll & view pay history', color: 'from-violet-500 to-purple-600' },
    { label: 'Advances', route: '/admin/advances', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></>, desc: 'Manage salary advance requests', color: 'from-rose-500 to-pink-600' },
    { label: 'Reports', route: '/admin/staff-reports', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>, desc: 'Staff & salary reports', color: 'from-cyan-500 to-sky-600' },
  ], []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">{staffLabel} Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/employees')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalStaff}</p>
          <p className="text-xs text-gray-400 mt-0.5">{activeEmployees.length} active</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/payroll')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Unpaid Amount</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(totalDueAmount)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatINR(totalPaidAmount)} paid</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/attendance')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Unpaid Hours</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalDueHours.toFixed(1)}h</p>
          <p className="text-xs text-gray-400 mt-0.5">{totalPaidHours.toFixed(1)}h paid</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/attendance')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Hours Logged</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalLoggedHours.toFixed(1)}h</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/piece-work/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Unpaid Qty</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalDueQty.toFixed(1)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{totalPaidQty.toFixed(1)} paid</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/piece-work/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Qty Logged</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalLoggedQty.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Staff Summary</h3>
            <button onClick={() => navigate('/admin/staff-reports?tab=salary')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Hours / Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amounts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60">
                {activeEmployees.slice(0, 10).map(emp => {
                  const empId = emp.id;
                  const isPiece = (emp.salary_type || 'fixed') === 'piece';
                  const payRec = monthPayrollByEmployee[empId];
                  const paidAmount = payRec?.status === 'paid' ? payRec.amount : 0;
                  const paidVal = payRec?.status === 'paid' ? payRec.hours : 0;

                  let dueVal = 0, dueAmount = 0, totalVal = 0;
                  if (isPiece) {
                    const pCal = pieceCalendarByEmployee[empId];
                    dueVal = pCal?.unpaidQty || 0;
                    dueAmount = pCal?.unpaidAmt || 0;
                    totalVal = dueVal + (pCal?.paidQty || 0);
                  } else {
                    const cal = calendarPayrollByEmployee[empId];
                    dueVal = cal?.hours || 0;
                    dueAmount = cal?.due || 0;
                    totalVal = dueVal + paidVal;
                  }

                  const paidPct = totalVal > 0 ? Math.round((paidVal / totalVal) * 100) : 0;
                  const unitLabel = isPiece ? '' : 'h';
                  const colLabel = isPiece ? 'qty' : 'hours';
                  const initials = `${(emp.first_name || '')[0]}${(emp.last_name || '')[0]}`.toUpperCase();
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/employees?id=${emp.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100/70 text-indigo-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {initials}
                          </div>
                          <span className="font-medium text-gray-800 text-sm truncate">{emp.first_name} {emp.last_name}</span>
                          {isPiece && <span className="badge badge-success text-[10px]">Piece</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {totalVal > 0 ? (
                          <div className="flex flex-col gap-1.5 max-w-[160px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-600 font-medium">{dueVal.toFixed(1)}{unitLabel} unpaid</span>
                              <span className="text-emerald-600 font-medium">{paidVal.toFixed(1)}{unitLabel} paid</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end text-xs leading-tight gap-0.5">
                          {dueAmount > 0 ? (
                            <span className="text-amber-700 font-semibold">{formatINR(dueAmount)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                          {paidAmount > 0 ? (
                            <span className="text-emerald-600 font-medium">{formatINR(paidAmount)}</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {activeEmployees.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-8 text-sm text-gray-400">No active employees</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={() => navigate(a.route)}
                className={`flex flex-col items-start text-left p-4 rounded-xl border border-gray-200 hover:border-transparent transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-br ${a.color}`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white mb-3 shrink-0 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{a.icon}</svg>
                </div>
                <span className="text-sm font-semibold text-white">{a.label}</span>
                <span className="text-[11px] text-white/70 mt-0.5 leading-tight">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Attendance Today</h3>
          <button onClick={() => navigate('/admin/attendance')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Full Calendar</button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Hours / Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60">
                {(() => {
                  const rows = [];
                  if (calendarData) {
                    for (const emp of calendarData.employees) {
                      if (emp.employee?.salaryType === 'piece') continue;
                      const dayData = emp.days.find(d => d.date === todayStr);
                      if (!dayData) continue;
                      const initials = `${(emp.employee.firstName || '')[0]}${(emp.employee.lastName || '')[0]}`.toUpperCase();
                      rows.push({ ...dayData, id: emp.employee.id, firstName: emp.employee.firstName, lastName: emp.employee.lastName, initials, isPiece: false });
                    }
                  }
                  if (pieceCalendarData) {
                    for (const emp of pieceCalendarData.employees) {
                      const day = emp.days.find(d => d.date === todayStr);
                      const initials = `${(emp.employee.firstName || '')[0]}${(emp.employee.lastName || '')[0]}`.toUpperCase();
                      if (!day || day.type === 'none') {
                        rows.push({ id: emp.employee.id, firstName: emp.employee.firstName, lastName: emp.employee.lastName, initials, type: 'none', hours: 0, isPiece: true });
                      } else if (day.type === 'absent') {
                        rows.push({ id: emp.employee.id, firstName: emp.employee.firstName, lastName: emp.employee.lastName, initials, type: 'absent', hours: 0, isPiece: true });
                      } else {
                        rows.push({ ...day, id: emp.employee.id, firstName: emp.employee.firstName, lastName: emp.employee.lastName, initials, type: day.isPaid ? 'paid' : 'present', hours: day.totalQuantity, isPiece: true });
                      }
                    }
                  }
                  if (rows.length === 0) return <tr><td colSpan={3} className="text-center py-6 text-gray-400 text-sm">No attendance data</td></tr>;
                  return rows.map(r => {
                    const type = r.type;
                    const statusLabel = type === 'idle' || type === 'none' ? 'No Record' : type.charAt(0).toUpperCase() + type.slice(1);
                    const leaveTypes = ['sick','annual','casual','unpaid'];
                    const rowBg = type === 'present' || type === 'paid' ? 'bg-emerald-50/40' : type === 'absent' ? 'bg-red-50/40' : leaveTypes.includes(type) ? 'bg-amber-50/40' : '';
                    const dotColor = type === 'present' || type === 'paid' ? 'bg-emerald-500' : type === 'absent' ? 'bg-red-500' : leaveTypes.includes(type) ? 'bg-amber-500' : 'bg-gray-300';
                    const badgeClass = type === 'present' || type === 'paid' ? 'bg-emerald-100 text-emerald-700' : type === 'absent' ? 'bg-red-100 text-red-700' : leaveTypes.includes(type) ? 'bg-amber-100 text-amber-700' : type === 'weekend' ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-400';
                    return (
                      <tr key={`${r.isPiece ? 'pw-' : ''}${r.id}`} className={`hover:bg-gray-50/60 transition-colors ${rowBg}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/80 text-gray-700 flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm border border-gray-200">
                              {r.initials}
                            </div>
                            <span className="font-medium text-gray-800 text-sm">{r.firstName} {r.lastName}</span>
                            {r.isPiece && <span className="badge badge-success text-[10px]">Piece</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${badgeClass}`}>
                            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-gray-700">{r.hours ? `${r.hours}${r.isPiece ? '' : 'h'}` : '—'}</span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

export default HrDashboard;
