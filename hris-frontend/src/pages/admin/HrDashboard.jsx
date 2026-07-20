import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import Loading from '../../components/Loading';

const HrDashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const absentTypes = ['absent'];
  const leaveTypes = ['sick', 'annual', 'casual', 'unpaid'];

  useEffect(() => {
    Promise.all([
      hrService.getEmployees().catch(() => []),
      hrService.getEmployeeCalendar({ month: currentMonth, year: currentYear }).catch(() => null),
      hrService.getPayrollHistory().catch(() => []),
    ]).then(([emps, cal, pay]) => {
      setEmployees(emps);
      setCalendarData(cal);
      setPayroll(Array.isArray(pay) ? pay : []);
    }).finally(() => setLoading(false));
  }, []);

  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const totalStaff = employees.length;

  const todayAttendance = useMemo(() => {
    let present = 0, absent = 0, leave = 0;
    if (calendarData) {
      for (const emp of calendarData.employees) {
        for (const day of emp.days) {
          if (day.date === todayStr) {
            if (day.type === 'present') present++;
            else if (absentTypes.includes(day.type)) absent++;
            else if (leaveTypes.includes(day.type)) leave++;
          }
        }
      }
    }
    return { present, absent, leave };
  }, [calendarData, todayStr]);

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

  const totalDue = useMemo(() => {
    return Object.values(calendarPayrollByEmployee).reduce((s, v) => s + v.due, 0);
  }, [calendarPayrollByEmployee]);

  const totalPaid = useMemo(() => {
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
      if (rec.status === 'paid') hours += rec.hours;
    }
    return hours;
  }, [monthPayrollByEmployee]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">HR Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/employees')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalStaff}</p>
          <p className="text-xs text-gray-400 mt-0.5">{activeEmployees.length} active</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Present Today</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{todayAttendance.present}</p>
          <p className="text-xs text-gray-400 mt-0.5">{todayAttendance.absent} absent, {todayAttendance.leave} on leave</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/payroll')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Due Amount</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(totalDue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatINR(totalPaid)} paid</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Due Hours</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalDueHours.toFixed(1)}h</p>
          <p className="text-xs text-gray-400 mt-0.5">{totalPaidHours.toFixed(1)}h paid</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Hours Logged</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalLoggedHours.toFixed(1)}h</p>
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
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Due Hrs</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Due Amt</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Paid Hrs</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Paid Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeEmployees.slice(0, 10).map(emp => {
                  const empId = emp.id;
                  const calHours = monthHoursByEmployee[empId] || 0;
                  const payRec = monthPayrollByEmployee[empId];
                  const paidHours = payRec?.status === 'paid' ? payRec.hours : 0;
                  const paidAmount = payRec?.status === 'paid' ? payRec.amount : 0;
                  const cal = calendarPayrollByEmployee[empId];
                  const dueHours = cal?.hours || 0;
                  const dueAmount = cal?.due || 0;
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => navigate(`/admin/employees?id=${emp.id}`)}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-800 truncate max-w-[140px]">{emp.first_name} {emp.last_name}</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-semibold">{dueHours > 0 ? `${dueHours.toFixed(1)}h` : '—'}</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-semibold">{dueAmount > 0 ? formatINR(dueAmount) : '—'}</td>
                      <td className="px-4 py-2.5 text-center text-emerald-600 font-semibold">{paidHours > 0 ? `${paidHours.toFixed(1)}h` : '—'}</td>
                      <td className="px-4 py-2.5 text-center text-emerald-600 font-semibold">{paidAmount > 0 ? formatINR(paidAmount) : '—'}</td>
                    </tr>
                  );
                })}
                {activeEmployees.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No active employees</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/admin/employees')} className="btn-secondary text-sm">Staff Directory</button>
            <button onClick={() => navigate('/admin/calendar')} className="btn-secondary text-sm">Attendance</button>
            <button onClick={() => navigate('/admin/leaves')} className="btn-secondary text-sm">Leave Approvals</button>
            <button onClick={() => navigate('/admin/payroll')} className="btn-secondary text-sm">Payroll</button>
            <button onClick={() => navigate('/admin/advances')} className="btn-secondary text-sm">Advances</button>
            <button onClick={() => navigate('/admin/staff-reports')} className="btn-secondary text-sm">Reports</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Attendance Today</h3>
          <button onClick={() => navigate('/admin/calendar')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Full Calendar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {calendarData?.employees.map(emp => {
                const dayData = emp.days.find(d => d.date === todayStr);
                if (!dayData) return null;
                return (
                  <tr key={emp.employee.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{emp.employee.firstName} {emp.employee.lastName}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        dayData.type === 'present' ? 'bg-emerald-100 text-emerald-700' :
                        dayData.type === 'absent' ? 'bg-red-100 text-red-700' :
                        ['sick','annual','casual','unpaid'].includes(dayData.type) ? 'bg-amber-100 text-amber-700' :
                        dayData.type === 'weekend' ? 'bg-gray-100 text-gray-400' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {dayData.type === 'idle' ? 'No Record' : dayData.type.charAt(0).toUpperCase() + dayData.type.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{dayData.hours ? `${dayData.hours}h` : '-'}</td>
                  </tr>
                );
              })}
              {(!calendarData || calendarData.employees.length === 0) && (
                <tr><td colSpan={3} className="text-center py-6 text-gray-400 text-sm">No attendance data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HrDashboard;
