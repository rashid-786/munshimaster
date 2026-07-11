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
  const todayStr = now.toISOString().split('T')[0];
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

  const totalHoursWorked = useMemo(() => {
    return Object.values(monthHoursByEmployee).reduce((s, v) => s + v, 0);
  }, [monthHoursByEmployee]);

  const monthPayByEmployee = useMemo(() => {
    const map = {};
    for (const p of payroll) {
      const endDate = new Date(p.pay_period_end);
      if (endDate.getMonth() + 1 === currentMonth && endDate.getFullYear() === currentYear) {
        const empId = p.employee_id;
        map[empId] = (map[empId] || 0) + parseFloat(p.net_salary || 0);
      }
    }
    return map;
  }, [payroll, currentMonth, currentYear]);

  const totalDueThisMonth = useMemo(() => {
    return Object.values(monthPayByEmployee).reduce((s, v) => s + v, 0);
  }, [monthPayByEmployee]);

  const totalDue = useMemo(() => {
    return payroll
      .filter(p => p.status === 'due' || p.status === 'draft')
      .reduce((s, p) => s + parseFloat(p.net_salary || 0), 0);
  }, [payroll]);

  const totalPaid = useMemo(() => {
    return payroll
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + parseFloat(p.net_salary || 0), 0);
  }, [payroll]);

  const employeePayStatus = useMemo(() => {
    const map = {};
    for (const p of payroll) {
      if (p.net_salary <= 0) continue;
      const eid = p.employee_id;
      if (!map[eid] || map[eid] === 'paid') {
        map[eid] = p.status === 'paid' ? 'paid' : 'due';
      }
    }
    return map;
  }, [payroll]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">HR Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Due</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(totalDue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatINR(totalPaid)} paid</p>
        </div>
        <div className="card p-4 cursor-pointer" onClick={() => navigate('/admin/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Hours Worked</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalHoursWorked.toFixed(1)}h</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Staff Summary</h3>
            <button onClick={() => navigate('/admin/employees')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {activeEmployees.slice(0, 10).map(emp => {
              const empId = emp.id;
              const hours = monthHoursByEmployee[empId] || 0;
              const pay = monthPayByEmployee[empId] || 0;
              const payStatus = employeePayStatus[empId];
              return (
                <div
                  key={emp.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => navigate(`/admin/employees?id=${emp.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-gray-400">{emp.role || 'Employee'}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {payStatus && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${payStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {payStatus === 'paid' ? 'Paid' : 'Due'}
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Hours</p>
                      <p className="text-sm font-semibold text-gray-700">{hours.toFixed(1)}h</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs text-gray-400">Amount</p>
                      <p className="text-sm font-semibold text-emerald-600">{pay ? formatINR(pay) : '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeEmployees.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No active employees</div>
            )}
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
