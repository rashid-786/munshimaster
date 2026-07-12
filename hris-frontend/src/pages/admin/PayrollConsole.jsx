import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import ConfirmModal from '../../components/ConfirmModal';
import useIsMobile from '../../hooks/useIsMobile';

const today = (() => { const n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'); })();

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
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState(null);
  const [advanceDeductionPct, setAdvanceDeductionPct] = useState(null);
  const [manualAdvDeductions, setManualAdvDeductions] = useState({});
  const [savingManualAdv, setSavingManualAdv] = useState(null);
  const [advDedError, setAdvDedError] = useState('');

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
        const [hist, emps, settings] = await Promise.all([
          hrService.getPayrollHistory(),
          hrService.getEmployees(),
          hrService.getTenantSettings().catch(() => null),
        ]);
        setHistory(hist);
        setEmployees(emps);
        if (settings?.settings?.advanceDeductionPct !== undefined) {
          setAdvanceDeductionPct(settings.settings.advanceDeductionPct);
        }
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

  const toggleHistoryAll = useCallback(() => {
    if (selectedHistoryIds.size > 0) {
      setSelectedHistoryIds(new Set());
    } else {
      setSelectedHistoryIds(new Set(filteredHistory.map(r => r.id)));
    }
  }, [filteredHistory, selectedHistoryIds]);

  const toggleHistoryId = useCallback((id) => {
    setSelectedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCancelPayroll = (record) => {
    setDeleteModal({
      title: 'Cancel Payroll',
      message: `Cancel ${record.first_name} ${record.last_name}'s payroll (${record.total_hours_worked}h, ${formatINR(record.net_salary)})? This will delete the record so you can rework it.`,
      confirmLabel: 'Cancel Payroll',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await hrService.deletePayrollHistory([record.id]);
          setMessage('Payroll cancelled.');
          fetchHistory();
        } catch (err) {
          setMessage(err.response?.data?.error || 'Failed to cancel payroll.');
        }
        setDeleteModal(null);
      },
    });
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedHistoryIds];
    setDeleteModal({
      title: 'Delete Payroll Records',
      message: `Delete ${ids.length} payroll record(s)? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await hrService.deletePayrollHistory(ids);
          setMessage(`${ids.length} record(s) deleted.`);
          setSelectedHistoryIds(new Set());
          fetchHistory();
        } catch (err) {
          setMessage(err.response?.data?.error || 'Failed to delete records.');
        }
        setDeleteModal(null);
      },
    });
  };

  const handleManualAdvInputChange = (payrollId, value) => {
    const num = parseFloat(value) || 0;
    setManualAdvDeductions(prev => ({ ...prev, [payrollId]: Math.round(num * 100) }));
    setAdvDedError('');
  };

  const handleSaveManualAdvDeduction = async (record) => {
    const deduction = manualAdvDeductions[record.id];
    if (deduction === undefined || deduction === null) return;
    const outstanding = Number(record.outstanding_advance) || 0;
    if (deduction > outstanding) {
      setAdvDedError(
        `Advance deduction cannot exceed the employee's outstanding advance balance (₹${(outstanding / 100).toFixed(2)}).`
      );
      return;
    }
    setSavingManualAdv(record.id);
    setAdvDedError('');
    try {
      await hrService.updateManualAdvanceDeduction(record.id, deduction);
      const updated = await hrService.getPayrollHistory();
      setHistory(updated);
    } catch (err) {
      setAdvDedError(err.response?.data?.error || 'Failed to update advance deduction.');
    } finally {
      setSavingManualAdv(null);
    }
  };

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0 || (selectedIds.size === 1 && selectedIds.has(ALL_EMPLOYEES_KEY))) {
      setMessage('Please select at least one employee.');
      return;
    }
    if (payPeriod.endDate > today) {
      setMessage('Pay period end date cannot be in the future.');
      return;
    }
    if (payPeriod.startDate > payPeriod.endDate) {
      setMessage('Start date must be on or before end date.');
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
    { key: 'advance_deduction', label: 'Adv. Ded.', render: (v, r) => advanceDeductionPct === 0 && isDue(r.status) && Number(r.outstanding_advance) > 0 ? (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <input type="number" min="0" step="1"
            value={(manualAdvDeductions[r.id] ?? v) / 100}
            onChange={e => handleManualAdvInputChange(r.id, e.target.value)}
            className="w-16 text-xs border border-gray-300 rounded px-1 py-0.5 text-right" />
          <button onClick={() => handleSaveManualAdvDeduction(r)} disabled={savingManualAdv === r.id}
            className="btn-primary !py-0.5 !px-1.5 text-xs whitespace-nowrap inline-flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {savingManualAdv === r.id ? '...' : 'Set'}
          </button>
        </div>
        {Number(r.outstanding_advance) > 0 && (
          <span className="text-[10px] text-gray-400">Bal: {formatINR(r.outstanding_advance)}</span>
        )}
      </div>
    ) : v ? <span className="text-orange-600">{formatINR(v)}</span> : <span>-</span> },
    { key: 'net_salary', label: 'Net', render: (v) => <span className="font-bold text-emerald-600">{formatINR(v)}</span> },
    { key: 'status', label: 'Status', render: (_, r) => statusBadge(r.status) },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => isDue(r.status) ? (
      <button onClick={(e) => handleMarkPaid(e, r)} disabled={saving === r.id}
        className="btn-success !py-1 !px-1.5 text-xs" title="Mark Paid">
        {saving === r.id ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        )}
      </button>
    ) : <span className="text-xs text-gray-400 font-medium">Done</span> },
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
              <input type="date" value={payPeriod.endDate} onChange={e => setPayPeriod({ ...payPeriod, endDate: e.target.value })} max={today} className="input-field" required />
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

      {advDedError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{advDedError}</div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payroll History</h3>
          <div className="flex items-center gap-2">
            {selectedHistoryIds.size > 0 && (
              <button onClick={handleDeleteSelected} className="btn-danger !py-1.5 !px-3 text-xs inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete {selectedHistoryIds.size} selected
              </button>
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
          <table className="w-full text-sm min-w-[1050px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-3 py-2.5 text-left">
                  <input type="checkbox" checked={selectedHistoryIds.size === filteredHistory.length && filteredHistory.length > 0}
                    onChange={toggleHistoryAll} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="table-header">Employee</th>
                <th className="table-header">Period</th>
                <th className="table-header">Rate</th>
                <th className="table-header">Hrs</th>
                <th className="table-header">Gross</th>
                <th className="table-header">Adv. Ded.</th>
                <th className="table-header">Net</th>
                <th className="table-header">Status</th>
                <th className="table-header text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredHistory.map(r => (
                <tr key={r.id} className="table-row-hover cursor-pointer" onClick={() => setSelectedHistory(r)}>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedHistoryIds.has(r.id)}
                      onChange={() => toggleHistoryId(r.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  </td>
                  <td className="table-cell font-medium">{r.first_name} {r.last_name}</td>
                  <td className="table-cell text-gray-500">{(r.pay_period_start || '').split('T')[0]} to {(r.pay_period_end || '').split('T')[0]}</td>
                  <td className="table-cell">₹{(r.hourly_rate / 100).toFixed(2)}/hr</td>
                  <td className="table-cell">{r.total_hours_worked}h / {r.standard_hours}h</td>
                  <td className="table-cell">{formatINR(r.gross_salary)}</td>
                  <td className="table-cell">{advanceDeductionPct === 0 && isDue(r.status) && Number(r.outstanding_advance) > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" step="1"
                          value={(manualAdvDeductions[r.id] ?? r.advance_deduction) / 100}
                          onChange={e => handleManualAdvInputChange(r.id, e.target.value)}
                          className="w-20 text-xs border border-gray-300 rounded px-1 py-0.5 text-right" />
                        <button onClick={() => handleSaveManualAdvDeduction(r)} disabled={savingManualAdv === r.id}
                          className="btn-primary !py-0.5 !px-1.5 text-xs whitespace-nowrap inline-flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {savingManualAdv === r.id ? '...' : 'Apply'}
                        </button>
                      </div>
                      {Number(r.outstanding_advance) > 0 && (
                        <span className="text-[10px] text-gray-400">Bal: {formatINR(r.outstanding_advance)}</span>
                      )}
                    </div>
                  ) : r.advance_deduction ? <span className="text-orange-600">{formatINR(r.advance_deduction)}</span> : <span>-</span>}</td>
                  <td className="table-cell font-bold text-emerald-600">{formatINR(r.net_salary)}</td>
                  <td className="table-cell">{statusBadge(r.status)}</td>
                  <td className="table-cell text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      {isDue(r.status) ? (
                        <>
                          <button onClick={(e) => handleMarkPaid(e, r)} disabled={saving === r.id}
                            className="btn-success !py-1 !px-1.5 text-xs" title="Mark Paid">
                            {saving === r.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                          </button>
                          <button onClick={() => handleCancelPayroll(r)} className="btn-danger !py-1 !px-1.5 text-xs" title="Cancel">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </>
                      ) : <span className="text-xs text-gray-400 font-medium">Done</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-sm text-gray-400">No payroll history</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {deleteModal && (
        <ConfirmModal
          open={!!deleteModal}
          onCancel={() => setDeleteModal(null)}
          onConfirm={deleteModal.onConfirm}
          title={deleteModal.title}
          message={deleteModal.message}
          confirmLabel={deleteModal.confirmLabel}
          variant={deleteModal.variant}
        />
      )}

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
                {advanceDeductionPct === 0 && isDue(selectedHistory.status) && Number(selectedHistory.outstanding_advance) > 0 ? (
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" step="1"
                        value={(manualAdvDeductions[selectedHistory.id] ?? selectedHistory.advance_deduction) / 100}
                        onChange={e => handleManualAdvInputChange(selectedHistory.id, e.target.value)}
                        className="w-24 text-xs border border-gray-300 rounded px-1.5 py-1 text-right" />
                      <button onClick={() => handleSaveManualAdvDeduction(selectedHistory)} disabled={savingManualAdv === selectedHistory.id}
                        className="btn-primary !py-1 !px-2 text-xs whitespace-nowrap inline-flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {savingManualAdv === selectedHistory.id ? '...' : 'Apply'}
                      </button>
                    </div>
                    {Number(selectedHistory.outstanding_advance) > 0 && (
                      <span className="text-[10px] text-gray-400">Bal: {formatINR(selectedHistory.outstanding_advance)}</span>
                    )}
                  </div>
                ) : selectedHistory.advance_deduction ? <span className="text-orange-600">{formatINR(selectedHistory.advance_deduction)}</span> : '—'}
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
                  className="w-full btn-success text-sm justify-center mt-2 inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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
