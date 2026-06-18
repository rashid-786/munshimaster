import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Profile = () => {
  const [payslips, setPayslips] = useState([]);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => {
    hrService.getPayrollHistory().then(setPayslips).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const map = {};
    for (const slip of payslips) {
      const d = new Date(slip.pay_period_start);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!map[key]) map[key] = { label, key, slips: [] };
      map[key].slips.push(slip);
    }
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
  }, [payslips]);

  const months = useMemo(() => {
    const s = new Set();
    for (const slip of payslips) {
      const d = new Date(slip.pay_period_start);
      s.add(`${MONTHS[d.getMonth()]}`);
    }
    return [...s];
  }, [payslips]);

  const years = useMemo(() => {
    const s = new Set();
    for (const slip of payslips) {
      s.add(new Date(slip.pay_period_start).getFullYear());
    }
    return [...s].sort((a, b) => b - a);
  }, [payslips]);

  const filtered = useMemo(() => {
    return grouped.filter(g => {
      const [y, m] = g.key.split('-');
      if (filterMonth && MONTHS[parseInt(m)] !== filterMonth) return false;
      if (filterYear && y !== filterYear) return false;
      return true;
    });
  }, [grouped, filterMonth, filterYear]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Payslips</h2>
        <div className="flex gap-2">
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field max-w-[140px]">
            <option value="">All Months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="input-field max-w-[120px]">
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <p className="text-gray-400 text-center py-8">No payslips found</p>
        </div>
      ) : (
        filtered.map(group => (
          <div key={group.key} className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">{group.label}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {group.slips.map(slip => (
                <div key={slip.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">
                      {(slip.pay_period_start || '').split('T')[0]} to {(slip.pay_period_end || '').split('T')[0]}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Rs.{(slip.hourly_rate / 100).toFixed(2)}/hr &middot; {slip.total_hours_worked}h worked &middot; {slip.standard_hours}h standard
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-green-600">Gross: {formatINR(slip.gross_salary)}</span>
                      <span className="text-red-500">Deductions: -{formatINR(slip.deductions)}</span>
                      {slip.advance_deduction > 0 && <span className="text-orange-500">Adv: -{formatINR(slip.advance_deduction)}</span>}
                      <span className="text-gray-900 font-bold">Net: {formatINR(slip.net_salary)}</span>
                    </div>
                  </div>
                  <button onClick={() => hrService.downloadPayslipFile(slip.id)} className="btn-secondary shrink-0">
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Profile;
