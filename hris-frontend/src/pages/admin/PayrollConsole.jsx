import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const ALL_EMPLOYEES_KEY = '__ALL__';

const PayrollConsole = () => {
  const isMobile = useIsMobile();
  const [payPeriod, setPayPeriod] = useState({ startDate: '', endDate: '' });

  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [payrun, setPayrun] = useState(null);
  const [selectedPayrun, setSelectedPayrun] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await hrService.getPayrollHistory();
      setHistory(data);
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [hist, emps] = await Promise.all([
          hrService.getPayrollHistory(),
          hrService.getEmployees(),
        ]);
        setHistory(hist);
        setEmployees(emps);
      } catch {} finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.has(ALL_EMPLOYEES_KEY)) {
      setSelectedIds(new Set());
    } else {
      const all = new Set([ALL_EMPLOYEES_KEY]);
      employees.forEach(e => all.add(e.id));
      setSelectedIds(all);
    }
  }, [employees, selectedIds]);

  const toggleEmployee = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(ALL_EMPLOYEES_KEY);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleMarkPaid = async (e, rec) => {
    e.stopPropagation();
    setSaving(rec.id);
    try {
      await hrService.markPayrollPaid(rec.id);
      fetchHistory();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to mark as paid.');
    } finally {
      setSaving(null);
    }
  };

  const filteredHistory = useMemo(() => {
    if (!search) return history;
    const q = search.toLowerCase();
    return history.filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(q));
  }, [history, search]);

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0 || (selectedIds.size === 1 && selectedIds.has(ALL_EMPLOYEES_KEY))) {
      setMessage('Please select at least one employee.');
      return;
    }
    try {
      const payload = {
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
        employeeIds: [...selectedIds].filter(id => id !== ALL_EMPLOYEES_KEY),
      };
      const res = await hrService.runPayroll(payload);
      setMessage(res.message);
      setPayrun(res);
      hrService.getPayrollHistory().then(setHistory).catch(() => {});
    } catch (err) {
      setMessage(err.response?.data?.error || 'Payroll run failed.');
    }
  };

  const payrunColumns = [
    { key: 'employeeName', label: 'Employee', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'hourlyRate', label: 'Rate', render: (v) => <>₹{v}/hr</> },
    { key: 'hoursWorked', label: 'Worked', render: (v) => <>{v}h</> },
    { key: 'standardHours', label: 'Std Hrs', render: (v) => <>{v}h</> },
    { key: 'gross', label: 'Gross', render: (v) => formatINR(Math.round(parseFloat(v) * 100)) },
    { key: 'advanceDeduction', label: 'Adv. Ded.', render: (v) => v && parseFloat(v) > 0 ? <span className="text-orange-600">{formatINR(Math.round(parseFloat(v) * 100))}</span> : <span>-</span> },
    { key: 'net', label: 'Net', render: (v) => <span className="font-bold text-emerald-600">{formatINR(Math.round(parseFloat(v) * 100))}</span> },
  ];

  const statusBadge = (status) => {
    if (status === 'paid') return <span className="badge-success">Paid</span>;
    return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Due</span>;
  };

  const isDue = (status) => status === 'due' || status === 'draft';

  const historyColumns = [
    { key: 'employee_name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'period', label: 'Period', render: (_, r) => <span className="text-gray-500">{(r.pay_period_start || '').split('T')[0]} to {(r.pay_period_end || '').split('T')[0]}</span> },
    { key: 'hourly_rate', label: 'Rate', render: (v) => <>₹{(v / 100).toFixed(2)}/hr</> },
    { key: 'hours', label: 'Hrs', render: (_, r) => <>{r.total_hours_worked}h / {r.standard_hours}h</> },
    { key: 'gross_salary', label: 'Gross', render: (v) => formatINR(v) },
    { key: 'advance_deduction', label: 'Adv. Ded.', render: (v) => v ? <span className="text-orange-600">{formatINR(v)}</span> : <span>-</span> },
    { key: 'net_salary', label: 'Net', render: (v) => <span className="font-bold text-emerald-600">{formatINR(v)}</span> },
    { key: 'status', label: 'Status', render: (_, r) => statusBadge(r.status) },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => isDue(r.status) ? (
      <button onClick={(e) => handleMarkPaid(e, r)} disabled={saving === r.id}
        className="btn-success !py-1 !px-2.5 text-xs whitespace-nowrap">
        {saving === r.id ? '...' : 'Mark Paid'}
      </button>
    ) : null },
  ];

  const payrunData = payrun?.runs?.map((r, i) => ({ ...r, _key: String(i) })) || [];

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => { setMessage(''); setPayrun(null); }} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      {payrun && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Results</h3>
          <ResponsiveTable
            columns={payrunColumns}
            data={payrunData}
            keyField="_key"
            searchKeys={['employeeName']}
            mobilePrimary="employeeName"
            mobileSecondary="net"
            onRowClick={(r) => setSelectedPayrun(r)}
            emptyMessage="No results"
            loading={loading}
          />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Run Payroll</h3>
        </div>
        <form onSubmit={handleRunPayroll} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input type="date" value={payPeriod.startDate} onChange={e => setPayPeriod({ ...payPeriod, startDate: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input type="date" value={payPeriod.endDate} onChange={e => setPayPeriod({ ...payPeriod, endDate: e.target.value })} className="input-field" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              <label className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 sticky top-0">
                <input type="checkbox" checked={selectedIds.has(ALL_EMPLOYEES_KEY)}
                  onChange={toggleAll} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-medium text-gray-700">All Employees ({employees.length})</span>
              </label>
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={selectedIds.has(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">{emp.first_name} {emp.last_name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{emp.pay_per_hour ? `₹${(emp.pay_per_hour / 100).toFixed(2)}/hr` : `₹${((emp.base_salary || 0) / 100).toFixed(2)}/mo`}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {selectedIds.has(ALL_EMPLOYEES_KEY)
                ? `All ${employees.length} employees selected`
                : `${selectedIds.size} employee${selectedIds.size !== 1 ? 's' : ''} selected`}
            </p>
          </div>

          <button type="submit" disabled={selectedIds.size === 0} className="btn-primary">
            Calculate & Process Payroll
          </button>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payroll History</h3>
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
        <ResponsiveTable
          columns={historyColumns}
          data={filteredHistory}
          keyField="id"
          searchKeys={['first_name', 'last_name']}
          mobilePrimary="employee_name"
          mobileSecondary="net_salary"
          onRowClick={(r) => setSelectedHistory(r)}
          emptyMessage="No payroll history"
          loading={loading}
        />
      </div>

      {isMobile && (
        <BottomSheet
          open={!!selectedPayrun}
          onClose={() => setSelectedPayrun(null)}
          title={selectedPayrun?.employeeName || 'Payroll Details'}
          actions={null}
        >
          {selectedPayrun && (
            <div className="space-y-3">
              <DetailRow label="Employee" value={selectedPayrun.employeeName} />
              <DetailRow label="Hourly Rate" value={`₹${selectedPayrun.hourlyRate}/hr`} />
              <DetailRow label="Hours Worked" value={`${selectedPayrun.hoursWorked}h`} />
              <DetailRow label="Standard Hours" value={`${selectedPayrun.standardHours}h`} />
              <DetailRow label="Gross" value={formatINR(Math.round(parseFloat(selectedPayrun.gross) * 100))} />
              <DetailRow label="Adv. Deduction">
                {selectedPayrun.advanceDeduction && parseFloat(selectedPayrun.advanceDeduction) > 0 ? (
                  <span className="text-orange-600">{formatINR(Math.round(parseFloat(selectedPayrun.advanceDeduction) * 100))}</span>
                ) : '—'}
              </DetailRow>
              <DetailRow label="Net">
                <span className="font-bold text-emerald-600">{formatINR(Math.round(parseFloat(selectedPayrun.net) * 100))}</span>
              </DetailRow>
            </div>
          )}
        </BottomSheet>
      )}

      {isMobile && (
        <BottomSheet
          open={!!selectedHistory}
          onClose={() => setSelectedHistory(null)}
          title={selectedHistory ? `${selectedHistory.first_name} ${selectedHistory.last_name}` : 'Payroll Details'}
          actions={null}
        >
          {selectedHistory && (
            <div className="space-y-3">
              <DetailRow label="Employee" value={`${selectedHistory.first_name} ${selectedHistory.last_name}`} />
              <DetailRow label="Period" value={`${(selectedHistory.pay_period_start || '').split('T')[0]} to ${(selectedHistory.pay_period_end || '').split('T')[0]}`} />
              <DetailRow label="Rate" value={`₹${(selectedHistory.hourly_rate / 100).toFixed(2)}/hr`} />
              <DetailRow label="Hours" value={`${selectedHistory.total_hours_worked}h / ${selectedHistory.standard_hours}h`} />
              <DetailRow label="Gross" value={formatINR(selectedHistory.gross_salary)} />
              <DetailRow label="Adv. Deduction">
                {selectedHistory.advance_deduction ? <span className="text-orange-600">{formatINR(selectedHistory.advance_deduction)}</span> : '—'}
              </DetailRow>
              <DetailRow label="Net">
                <span className="font-bold text-emerald-600">{formatINR(selectedHistory.net_salary)}</span>
              </DetailRow>
              <DetailRow label="Status">
                {statusBadge(selectedHistory.status)}
              </DetailRow>
              {isDue(selectedHistory.status) && (
                <button onClick={(e) => handleMarkPaid(e, selectedHistory)}
                  disabled={saving === selectedHistory.id}
                  className="w-full btn-success text-sm justify-center mt-2">
                  {saving === selectedHistory.id ? 'Processing...' : 'Mark as Paid'}
                </button>
              )}
            </div>
          )}
        </BottomSheet>
      )}
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
