import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import Loading from '../../components/Loading';
import useIsMobile from '../../hooks/useIsMobile';

const PERIOD_OPTIONS = [
  { key: 'weekly', label: 'Weekly (1 Week)' },
  { key: 'biweekly', label: 'Bi-Weekly (2 Weeks)' },
  { key: 'threeweeks', label: 'Three Weeks' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom', label: 'Custom Range' },
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
  if (key === 'weekly') return { startDate: addDays(todayStr, -6), endDate: todayStr };
  if (key === 'biweekly') return { startDate: addDays(todayStr, -13), endDate: todayStr };
  if (key === 'threeweeks') return { startDate: addDays(todayStr, -20), endDate: todayStr };
  if (key === 'monthly') return { startDate: fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: todayStr };
  return { startDate: '', endDate: '' };
}

const RunPayroll = ({ onSwitchToHistory }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [periodType, setPeriodType] = useState('monthly');
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [allRuns, setAllRuns] = useState([]);
  const [deductions, setDeductions] = useState({});
  const [deductionInput, setDeductionInput] = useState({});
  const [search, setSearch] = useState('');

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [processed, setProcessed] = useState(null);
  const [pieceTooltip, setPieceTooltip] = useState(null);
  const messageRef = useRef(null);

  useEffect(() => {
    if (message && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [message]);

  useEffect(() => {
    const init = getPeriodDates('monthly');
    setStartDate(init.startDate);
    setEndDate(init.endDate);
    hrService.getEmployees().then(emps => {
      setEmployees(emps);
      setSelectedIds(new Set());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let ignore = false;
    setLoadingPreview(true);
    hrService.previewPayroll({ startDate, endDate })
      .then(res => {
        if (ignore) return;
        const runs = res.runs || [];
        setAllRuns(runs);
        setDeductions(prev => {
          const next = {};
          for (const r of runs) next[r.employeeId] = r.suggestedAdvanceDeduction;
          return next;
        });
        setDeductionInput(prev => {
          const next = {};
          for (const r of runs) next[r.employeeId] = (r.suggestedAdvanceDeduction / 100).toFixed(2);
          return next;
        });
      })
      .catch(err => {
        if (!ignore) setMessage(err.response?.data?.error || 'Failed to preview payroll.');
      })
      .finally(() => { if (!ignore) setLoadingPreview(false); });
    return () => { ignore = true; };
  }, [startDate, endDate]);

  const visibleRuns = useMemo(() => {
    const q = search.toLowerCase();
    return allRuns.filter(r => !q || r.employeeName.toLowerCase().includes(q));
  }, [allRuns, search]);

  const selectedRuns = useMemo(() => allRuns.filter(r => selectedIds.has(r.employeeId)), [allRuns, selectedIds]);

  const clampedDeduction = (run) => {
    const raw = deductions[run.employeeId] ?? 0;
    return Math.min(raw, run.outstandingAdvance, run.dueAmount);
  };

  const summary = useMemo(() => {
    let employeesCount = 0, payroll = 0, deductionsSum = 0, payable = 0;
    for (const r of selectedRuns) {
      const adv = clampedDeduction(r);
      employeesCount += 1;
      payroll += r.dueAmount;
      deductionsSum += adv;
      payable += Math.max(0, r.dueAmount - adv);
    }
    return { employeesCount, payroll, deductionsSum, payable };
  }, [selectedRuns, deductions]);

  const handlePeriodChange = (key) => {
    setPeriodType(key);
    if (key !== 'custom') {
      const d = getPeriodDates(key);
      setStartDate(d.startDate);
      setEndDate(d.endDate);
    } else {
      setStartDate(customRange.startDate);
      setEndDate(customRange.endDate);
    }
  };

  const handleCustomChange = (field, value) => {
    const next = { ...customRange, [field]: value };
    setCustomRange(next);
    if (next.startDate && next.endDate) {
      setStartDate(next.startDate);
      setEndDate(next.endDate);
    }
  };

  const toggleEmployee = useCallback((id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const allSelected = employees.length > 0 && selectedIds.size === employees.length;
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(employees.map(e => e.id)));

  const visibleIds = visibleRuns.map(r => r.employeeId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const toggleVisibleAll = () => setSelectedIds(prev => {
    const n = new Set(prev);
    if (allVisibleSelected) visibleIds.forEach(id => n.delete(id));
    else visibleIds.forEach(id => n.add(id));
    return n;
  });

  const handleDeductionChange = (run, valueStr) => {
    let sanitized = valueStr.replace(/[^0-9.]/g, '');
    const firstDot = sanitized.indexOf('.');
    if (firstDot !== -1) {
      sanitized = sanitized.slice(0, firstDot + 1) + sanitized.slice(firstDot + 1).replace(/\./g, '');
    }
    const max = Math.min(run.outstandingAdvance, run.dueAmount) / 100;
    let v = parseFloat(sanitized) || 0;
    if (v < 0) v = 0;
    let display = sanitized;
    if (v > max) { v = max; display = max.toFixed(2); }
    setDeductionInput(prev => ({ ...prev, [run.employeeId]: display }));
    setDeductions(prev => ({ ...prev, [run.employeeId]: Math.round(v * 100) }));
  };

  const handleProcess = async () => {
    if (selectedIds.size === 0) { setMessage('Select at least one employee.'); return; }
    if (endDate > fmtDate(new Date())) { setMessage('Pay period end date cannot be in the future.'); return; }
    setProcessing(true);
    setMessage('');
    try {
      const employeeIds = [...selectedIds];
      const advanceDeductions = {};
      for (const id of employeeIds) advanceDeductions[id] = deductions[id] ?? 0;
      const res = await hrService.runPayroll({ startDate, endDate, employeeIds, advanceDeductions });
      setProcessed(res);
      setMessage(res.message || 'Payroll processed successfully.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Payroll processing failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Run Payroll</h2>
        <button onClick={() => onSwitchToHistory ? onSwitchToHistory() : navigate('/admin/payroll')} className="btn-secondary text-sm self-start">
          View History
        </button>
      </div>

      {message && (
        <div ref={messageRef} className={`p-3 rounded-lg text-sm flex items-center justify-between ${processed ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          <span>{message}</span>
          <button onClick={() => { setMessage(''); if (processed) { setProcessed(null); onSwitchToHistory ? onSwitchToHistory() : navigate('/admin/payroll'); } }} className="ml-3 text-current hover:opacity-70">&times;</button>
        </div>
      )}

      {/* Payroll Period */}
      <div className="card p-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payroll Period</label>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => handlePeriodChange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                periodType === opt.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {periodType === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="date" value={customRange.startDate} max={customRange.endDate || endDate}
                onChange={e => handleCustomChange('startDate', e.target.value)} className="input-field" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="date" value={customRange.endDate} min={customRange.startDate} max={fmtDate(new Date())}
                onChange={e => handleCustomChange('endDate', e.target.value)} className="input-field" />
            </div>
          </div>
        )}
        {startDate && endDate && (
          <p className="text-xs text-gray-400 mt-3">
            {startDate} to {endDate}
            {allRuns.length > 0 && ` · ${allRuns[0].standardHours}h standard`}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.employeesCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Payroll</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{formatINR(summary.payroll)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Deductions</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{formatINR(summary.deductionsSum)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Payable</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(summary.payable)}</p>
        </div>
      </div>

      {/* Employee Table */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Employees {selectedIds.size > 0 && <span className="text-gray-400 font-normal">({selectedIds.size} selected)</span>}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={toggleAll} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <div className="relative max-w-xs w-full sm:w-56">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 text-sm w-full" />
            </div>
          </div>
        </div>

        {loadingPreview ? (
          <div className="p-10 flex justify-center"><Loading text="Calculating preview..." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-3 py-2.5 text-left">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="table-header">Employee</th>
                  <th className="table-header">Type</th>
                  <th className="table-header text-right">Qty/Hours</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-right">Unpaid Amount</th>
                  <th className="table-header text-right">Advance Deduction</th>
                  <th className="table-header text-right">Total Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRuns.map(r => {
                  const adv = clampedDeduction(r);
                  const payable = Math.max(0, r.dueAmount - adv);
                  return (
                    <tr key={r.employeeId} className="table-row-hover">
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selectedIds.has(r.employeeId)} onChange={() => toggleEmployee(r.employeeId)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      <td className="table-cell font-medium">{r.employeeName}</td>
                      <td className="table-cell">
                        <span className={`badge ${r.salaryType === 'piece' ? 'badge-success' : 'badge-info'}`}>
                          {r.salaryType === 'piece' ? 'Per Piece' : 'Monthly/Hourly'}
                        </span>
                      </td>
                      <td className="table-cell text-right text-gray-500">{r.actualHours}{r.salaryType === 'piece' ? ` ${r.unitLabel || ''}` : 'h'}</td>
                      <td className="table-cell text-right text-gray-500">
                        {r.salaryType === 'piece' ? (
                          <div className="relative inline-block">
                            <span
                              onMouseEnter={(e) => setPieceTooltip({ run: r, el: e.currentTarget })}
                              onMouseLeave={() => setPieceTooltip(null)}
                              className="text-indigo-500 hover:text-indigo-700 text-xs font-medium cursor-pointer"
                            >View Details</span>
                          </div>
                        ) : `₹${(r.hourlyRate / 100).toFixed(2)}/hr`}
                      </td>
                      <td className="table-cell text-right font-medium text-gray-900">{formatINR(r.dueAmount)}</td>
                      <td className="table-cell text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <input type="text" inputMode="decimal" value={deductionInput[r.employeeId] ?? (adv / 100).toFixed(2)}
                            disabled={r.outstandingAdvance <= 0 || r.salaryType === 'piece'}
                            onChange={e => handleDeductionChange(r, e.target.value)}
                            className="w-24 text-xs border border-gray-300 rounded px-1.5 py-1 text-right disabled:bg-gray-100 disabled:text-gray-400" />
                          <span className="text-[10px] text-gray-400">
                            {r.salaryType === 'piece' ? 'No advance' : r.outstandingAdvance > 0 ? `Bal: ${formatINR(r.outstandingAdvance)}` : 'No advance'}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell text-right font-bold text-emerald-600">{formatINR(payable)}</td>
                    </tr>
                  );
                })}
                {visibleRuns.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-400">
                    {selectedIds.size === 0 ? 'No employees match your search' : 'No employees found'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          Preview updates automatically. Review unpaid amounts, advances &amp; deductions, then process.
        </p>
        <button onClick={handleProcess} disabled={processing || selectedIds.size === 0}
          className="btn-primary">
          {processing ? 'Processing...' : `Process Payroll · ${formatINR(summary.payable)}`}
        </button>
      </div>
      {/* Piece Work Tooltip */}
      {pieceTooltip?.el && (() => {
        const entries = pieceTooltip.run.pieceEntries || [];
        const rect = pieceTooltip.el.getBoundingClientRect();
        const grouped = {};
        entries.forEach(e => {
          const wt = e.workType || e.work_type || 'Other';
          if (!grouped[wt]) grouped[wt] = { workType: wt, unitLabel: e.unitLabel || e.unit_label || 'pcs', ratePerPiece: e.ratePerPiece || e.rate_per_piece || 0, quantity: 0, calculatedAmount: 0 };
          grouped[wt].quantity += parseFloat(e.quantity || 0);
          grouped[wt].calculatedAmount += parseInt(e.calculatedAmount || e.calculated_amount || 0);
        });
        const rows = Object.values(grouped);
        const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
        const totalAmt = rows.reduce((s, r) => s + r.calculatedAmount, 0);
        const spaceBelow = window.innerHeight - rect.bottom;
        const showAbove = spaceBelow < 350;
        return (
          <div
            className="fixed z-50"
            style={{ left: Math.min(rect.left, window.innerWidth - 420), top: showAbove ? rect.top - 6 : rect.bottom + 6 }}
            onMouseEnter={() => setPieceTooltip(pieceTooltip)}
            onMouseLeave={() => setPieceTooltip(null)}
          >
            <div className={`bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px] max-h-[320px] overflow-y-auto ${showAbove ? '-translate-y-full' : ''}`}>
              <div className="px-2.5 py-1.5 border-b border-gray-100 bg-gray-50 rounded-t-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{pieceTooltip.run.employeeName}</span>
                <span className="text-[11px] text-gray-400">{pieceTooltip.run.actualHours} {pieceTooltip.run.unitLabel || 'pcs'}</span>
              </div>
              {rows.length === 0 ? (
                <div className="px-2.5 py-4 text-center text-xs text-gray-400">No entries</div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Work Type</th>
                      <th className="text-left px-2.5 py-1.5 text-gray-500 font-medium">Unit</th>
                      <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Rate</th>
                      <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Qty</th>
                      <th className="text-right px-2.5 py-1.5 text-gray-500 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-2.5 py-1.5 text-gray-800 font-medium truncate max-w-[100px]">{r.workType}</td>
                        <td className="px-2.5 py-1.5 text-gray-500">{r.unitLabel}</td>
                        <td className="px-2.5 py-1.5 text-right text-gray-600 whitespace-nowrap">
                          {r.ratePerPiece > 0 ? `₹${(r.ratePerPiece / 100).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-gray-700">{r.quantity}</td>
                        <td className="px-2.5 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">{formatINR(r.calculatedAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="border-t border-gray-100 bg-gray-50 rounded-b-xl grid grid-cols-5 text-[11px] font-semibold">
                <span className="col-span-3 text-left px-2.5 py-1.5 text-gray-700">Total</span>
                <span className="text-center px-2.5 py-1.5 text-gray-500">{totalQty}</span>
                <span className="text-right px-2.5 py-1.5 text-gray-900">{formatINR(totalAmt)}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default RunPayroll;
