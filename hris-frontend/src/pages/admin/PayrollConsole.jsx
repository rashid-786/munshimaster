import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import Loading from '../../components/Loading';
import PieceWorkModal from '../../components/PieceWorkModal';
import useIsMobile from '../../hooks/useIsMobile';
import BottomSheet from '../../components/BottomSheet';
import ConfirmModal from '../../components/ConfirmModal';
import DateRangePicker from '../../components/DateRangePicker';

const PERIODS = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Bi-Weekly' },
  { key: 'threeweeks', label: 'Three Weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
];

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return fmtDate(d);
}

function getPeriodDates(key) {
  const today = new Date();
  const todayStr = fmtDate(today);
  if (key === 'weekly') return { start: addDays(todayStr, -6), end: todayStr };
  if (key === 'biweekly') return { start: addDays(todayStr, -13), end: todayStr };
  if (key === 'threeweeks') return { start: addDays(todayStr, -20), end: todayStr };
  if (key === 'monthly') return { start: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayStr };
  return { start: '', end: '' };
}

const PayrollConsole = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [calendarData, setCalendarData] = useState(null);
  const [pieceModal, setPieceModal] = useState(null);
  const pieceCache = useRef({});

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const todayStr = fmtDate(now);

  // Header cards mirror the HR Dashboard exactly (current-month company snapshot).
  useEffect(() => {
    let ignore = false;
    Promise.all([
      hrService.getEmployees().catch(() => []),
      hrService.getEmployeeCalendar({ month: currentMonth, year: currentYear }).catch(() => null),
    ]).then(([emps, cal]) => {
      if (ignore) return;
      setEmployees(emps);
      setCalendarData(cal);
    });
    return () => { ignore = true; };
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === filteredHistory.length ? new Set() : new Set(filteredHistory.map(r => r.id))
    );
  };

  const confirmDelete = (ids) => {
    if (!ids || ids.length === 0) return;
    setPendingDelete(ids);
  };

  const performDelete = async () => {
    const ids = pendingDelete;
    if (!ids || ids.length === 0) return;
    setDeleting(true);
    try {
      await hrService.deletePayrollHistory(ids);
      setHistory(h => h.filter(r => !ids.includes(r.id)));
      setSelectedIds(new Set());
      if (selected && ids.includes(selected.id)) setSelected(null);
      setPendingDelete(null);
    } catch (e) {
      console.error(e);
      setPendingDelete(null);
      setError('Failed to delete payroll records.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await hrService.getPayrollHistory();
        setHistory(data);
      } catch {} finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const range = useMemo(() => (period === 'custom' ? custom : getPeriodDates(period)), [period, custom]);

  const filteredHistory = useMemo(() => {
    const q = search.toLowerCase();
    return history.filter(r => {
      if (q && !`${r.first_name} ${r.last_name}`.toLowerCase().includes(q)) return false;
      const start = r.pay_period_start;
      const end = r.pay_period_end;
      if (period === 'custom') {
        if (!custom.start && !custom.end) return true;
        if (custom.start && start < custom.start) return false;
        if (custom.end && end > custom.end) return false;
        return true;
      }
      if (!range.start || !range.end) return true;
      return start >= range.start && end <= range.end;
    });
  }, [history, search, period, custom, range]);

  const totalStaff = employees.length;

  const todayAttendance = useMemo(() => {
    let present = 0, absent = 0, leave = 0;
    if (calendarData) {
      for (const emp of calendarData.employees) {
        for (const day of emp.days) {
          if (day.date === todayStr) {
            if (day.type === 'present') present++;
            else if (day.type === 'absent') absent++;
            else if (['sick', 'annual', 'casual', 'unpaid'].includes(day.type)) leave++;
          }
        }
      }
    }
    return { present, absent, leave };
  }, [calendarData, todayStr]);

  const calendarPayrollByEmployee = useMemo(() => {
    const map = {};
    if (!calendarData) return map;
    for (const emp of calendarData.employees) {
      const hours = emp.days.reduce((s, d) => s + (d.paid ? 0 : parseFloat(d.hours || 0)), 0);
      const payPerHour = Number(emp.employee.payPerHour || 0);
      map[emp.employee.id] = { hours, payPerHour, due: hours * payPerHour };
    }
    return map;
  }, [calendarData]);

  const totalDue = useMemo(() => Object.values(calendarPayrollByEmployee).reduce((s, v) => s + v.due, 0), [calendarPayrollByEmployee]);
  const totalDueHours = useMemo(() => Object.values(calendarPayrollByEmployee).reduce((s, v) => s + v.hours, 0), [calendarPayrollByEmployee]);
  const totalLoggedHours = useMemo(() => {
    if (!calendarData) return 0;
    return calendarData.employees.reduce((s, emp) => s + emp.days.reduce((t, d) => t + parseFloat(d.hours || 0), 0), 0);
  }, [calendarData]);

  const monthPayrollByEmployee = useMemo(() => {
    const map = {};
    for (const p of history) {
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
  }, [history, currentMonth, currentYear]);

  const totalPaid = useMemo(() => history.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(p.net_salary || 0), 0), [history]);
  const totalPaidHours = useMemo(() => {
    let hours = 0;
    for (const empId in monthPayrollByEmployee) {
      if (monthPayrollByEmployee[empId].status === 'paid') hours += monthPayrollByEmployee[empId].hours;
    }
    return hours;
  }, [monthPayrollByEmployee]);

  const handlePeriod = (key) => {
    setPeriod(key);
    if (key !== 'custom') setCustom({ start: '', end: '' });
  };

  const statusBadge = (status) => {
    if (status === 'paid') return <span className="badge-success">Paid</span>;
    return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Unpaid</span>;
  };

  if (loading) return <Loading text="Loading payroll history..." />;

  const cards = [
    { label: 'Total Staff', value: totalStaff, sub: `${employees.length} active`, accent: 'text-gray-900', onClick: () => navigate('/admin/employees') },
    { label: 'Present Today', value: todayAttendance.present, sub: `${todayAttendance.absent} absent, ${todayAttendance.leave} on leave`, accent: 'text-emerald-600', onClick: () => navigate('/admin/attendance') },
    { label: 'Total Unpaid Amount', value: formatINR(Math.round(totalDue)), sub: `${formatINR(Math.round(totalPaid))} paid`, accent: 'text-amber-600', onClick: () => navigate('/admin/payroll') },
    { label: 'Total Unpaid Hours', value: `${totalDueHours.toFixed(1)}h`, sub: `${totalPaidHours.toFixed(1)}h paid`, accent: 'text-amber-600', onClick: () => navigate('/admin/attendance') },
    { label: 'Total Hours Logged', value: `${totalLoggedHours.toFixed(1)}h`, sub: '', accent: 'text-indigo-600', onClick: () => navigate('/admin/attendance') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Payroll History</h2>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-medium">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className="card p-4 cursor-pointer" onClick={c.onClick}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.accent}`}>{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Records</h3>
            {selectedIds.size > 0 && (
              <button
                onClick={() => confirmDelete([...selectedIds])}
                disabled={deleting}
                className="text-xs font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md px-2.5 py-1 disabled:opacity-50"
              >
                Delete ({selectedIds.size})
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 rounded-lg">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => handlePeriod(p.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    period === p.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <DateRangePicker start={custom.start} end={custom.end} onChange={(s, e) => setCustom({ start: s, end: e })} />
            )}
            <div className="relative max-w-xs w-full sm:w-auto">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 text-sm w-full"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="table-header w-10">
                  <input
                    type="checkbox"
                    className="accent-red-500"
                    checked={filteredHistory.length > 0 && selectedIds.size === filteredHistory.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Rate</th>
                  <th className="table-header">Gross</th>
                  <th className="table-header">Adv. Ded.</th>
                  <th className="table-header">Net</th>
                  <th className="table-header">Status</th>
                  <th className="table-header w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredHistory.map(r => (
                <tr key={r.id} className="table-row-hover" onClick={() => setSelected(r)}>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="accent-red-500"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      aria-label={`Select ${r.first_name} ${r.last_name}`}
                    />
                  </td>
                  <td className="table-cell font-medium">{r.first_name} {r.last_name}</td>
                  <td className="table-cell">
                    <span className={`badge ${r.salary_type === 'piece' ? 'badge-success' : 'badge-info'}`}>
                      {r.salary_type === 'piece' ? 'Per Piece' : 'Monthly/Hourly'}
                    </span>
                  </td>
                  <td className="table-cell text-gray-500">{(r.pay_period_start || '').split('T')[0]} to {(r.pay_period_end || '').split('T')[0]}</td>
                  <td className="table-cell">
                    {r.salary_type === 'piece' ? (
                      <span
                        onClick={async () => {
                          const key = r.employee_id + r.pay_period_start + r.pay_period_end;
                          if (!pieceCache.current[key]) {
                            try {
                              const entries = await hrService.getPieceWorkEmployeeEntries({
                                employeeId: r.employee_id,
                                startDate: (r.pay_period_start || '').split('T')[0],
                                endDate: (r.pay_period_end || '').split('T')[0],
                              });
                              pieceCache.current[key] = entries;
                            } catch { pieceCache.current[key] = []; }
                          }
                          setPieceModal({ entries: pieceCache.current[key], employeeName: `${r.first_name} ${r.last_name}`, unitLabel: 'pcs', actualHours: r.total_hours_worked });
                        }}
                        className="text-indigo-500 hover:text-indigo-700 text-xs font-medium cursor-pointer"
                      >View Details</span>
                    ) : `₹${(r.hourly_rate / 100).toFixed(2)}/hr`}
                  </td>
                  <td className="table-cell">{formatINR(r.gross_salary)}</td>
                  <td className="table-cell">{r.advance_deduction ? <span className="text-orange-600">{formatINR(r.advance_deduction)}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="table-cell font-bold text-emerald-600">{formatINR(r.net_salary)}</td>
                  <td className="table-cell">{statusBadge(r.status)}</td>
                  <td className="table-cell text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => hrService.downloadPayslipFile(r.id)}
                      title="Download salary slip"
                      className="text-gray-400 hover:text-indigo-600 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                    <button
                      onClick={() => confirmDelete([r.id])}
                      disabled={deleting}
                      title="Delete record"
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-gray-400">No payroll records for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isMobile && (
        <BottomSheet
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected ? `${selected.first_name} ${selected.last_name}` : 'Payroll Details'}
          actions={null}
        >
          {selected && (
            <div className="space-y-3">
              <DetailRow label="Salary Type" value={selected.salary_type === 'piece' ? 'Per Piece' : 'Monthly/Hourly'} />
                  <DetailRow label="Period" value={`${(selected.pay_period_start || '').split('T')[0]} to ${(selected.pay_period_end || '').split('T')[0]}`} />
                  <DetailRow label="Rate" value={selected.salary_type === 'piece' ? formatINR(selected.hourly_rate)+'/pc' : `₹${(selected.hourly_rate / 100).toFixed(2)}/hr`} />
              <DetailRow label="Gross" value={formatINR(selected.gross_salary)} />
              <DetailRow label="Adv. Deduction" value={selected.advance_deduction ? formatINR(selected.advance_deduction) : '—'} />
              <DetailRow label="Net"><span className="font-bold text-emerald-600">{formatINR(selected.net_salary)}</span></DetailRow>
              <DetailRow label="Status">{statusBadge(selected.status)}</DetailRow>
              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => hrService.downloadPayslipFile(selected.id)}
                  className="w-full text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-md py-2"
                >
                  Download Salary Slip
                </button>
                <button
                  onClick={() => confirmDelete([selected.id])}
                  disabled={deleting}
                  className="w-full text-sm font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md py-2 disabled:opacity-50"
                >
                  Delete Record
                </button>
              </div>
            </div>
          )}
        </BottomSheet>
      )}

      <PieceWorkModal
        open={!!pieceModal}
        onClose={() => setPieceModal(null)}
        entries={pieceModal?.entries || []}
        employeeName={pieceModal?.employeeName || ''}
        actualHours={pieceModal?.actualHours || 0}
        unitLabel={pieceModal?.unitLabel || 'pcs'}
      />

      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete && pendingDelete.length > 1 ? `Delete ${pendingDelete.length} payroll records?` : 'Delete payroll record?'}
        message="This will permanently remove the record(s), restore any advance deductions, and mark the hours as unpaid again."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={performDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default PayrollConsole;
