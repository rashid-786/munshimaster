import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const HrDashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    Promise.all([
      hrService.getEmployees().catch(() => []),
      hrService.getEmployeeCalendar({ month, year }).catch(() => null),
      hrService.getPayrollHistory().catch(() => []),
    ]).then(([emps, cal, pay]) => {
      setEmployees(emps);
      setCalendarData(cal);
      setPayroll(Array.isArray(pay) ? pay : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const totalEmployees = employees.length;
  const today = new Date().toISOString().split('T')[0];
  let presentToday = 0, absentToday = 0, leaveToday = 0;
  if (calendarData) {
    calendarData.employees.forEach(emp => {
      emp.days.forEach(day => {
        if (day.date === today) {
          if (day.type === 'present') presentToday++;
          else if (['sick', 'annual', 'casual', 'unpaid'].includes(day.type)) leaveToday++;
          else if (day.type === 'absent') absentToday++;
        }
      });
    });
  }

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const totalPayrollThisMonth = payroll.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">HR Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4" onClick={() => navigate('/admin/employees')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmployees}</p>
          <p className="text-xs text-gray-400 mt-0.5">{activeEmployees} active</p>
        </div>
        <div className="card p-4" onClick={() => navigate('/admin/calendar')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Present Today</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{presentToday}</p>
          <p className="text-xs text-gray-400 mt-0.5">{absentToday} absent, {leaveToday} on leave</p>
        </div>
        <div className="card p-4" onClick={() => navigate('/admin/payroll')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Payroll This Month</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalPayrollThisMonth.toLocaleString()}</p>
        </div>
        <div className="card p-4" onClick={() => navigate('/admin/leaves')}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">On Leave</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{leaveToday}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Staff Directory</h3>
            <button onClick={() => navigate('/admin/employees')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {employees.slice(0, 5).map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/admin/employees?id=${emp.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{emp.first_name} {emp.last_name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{emp.role || 'Employee'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr><td colSpan={3} className="text-center py-6 text-gray-400 text-sm">No employees yet</td></tr>
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
            <button onClick={() => navigate('/admin/replacements')} className="btn-secondary text-sm">Replacements</button>
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
                const dayData = emp.days.find(d => d.date === today);
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
