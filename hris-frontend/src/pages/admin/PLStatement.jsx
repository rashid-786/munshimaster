import { useState, useEffect, useCallback } from 'react';
import EmptyState from '../../components/EmptyState';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const PERIODS = [
  { value: '', label: 'Custom' },
  { value: 'this_year', label: 'This Year' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

const fmtDate = (d) => d.toISOString().split('T')[0];

const calcPeriod = (period) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'this_year': return { startDate: `${y}-01-01`, endDate: fmtDate(now) };
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3;
      return { startDate: `${y}-${String(q + 1).padStart(2, '0')}-01`, endDate: fmtDate(now) };
    }
    case 'this_month': return { startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`, endDate: fmtDate(now) };
    case 'last_month': {
      const lm = new Date(y, m, 0);
      const ly = lm.getFullYear();
      const lmn = lm.getMonth();
      return { startDate: `${ly}-${String(lmn + 1).padStart(2, '0')}-01`, endDate: fmtDate(lm) };
    }
    default: return { startDate: '', endDate: '' };
  }
};

const fmtINR = (value) => `₹${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const formatMonth = (m) => {
  const d = new Date(m + '-01');
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

export default function PLStatement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('this_year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const p = calcPeriod(period);
    setStartDate(p.startDate);
    setEndDate(p.endDate);
  }, [period]);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError('');
    try {
      const result = await hrService.getPLStatement({ startDate, endDate });
      setData(result);
    } catch {
      setError('Failed to load P&L statement.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = data?.summary;

  if (loading) return <div className="flex justify-center py-20"><Loading /></div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Period</label>
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">From</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPeriod(''); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">To</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPeriod(''); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Income</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{fmtINR(s.totalIncome)}</p>
          <div className="mt-2 text-xs text-gray-400 space-y-0.5">
            <p>Revenue (Invoices): {fmtINR(s.revenue)} ({s.revenueCount} paid)</p>
            <p>Other Income: {fmtINR(s.otherIncome)} ({s.otherIncomeCount} entries)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-2">{fmtINR(s.totalExpenses)}</p>
          <div className="mt-2 text-xs text-gray-400 space-y-0.5">
            <p>Cost of Goods: {fmtINR(s.cogs)} ({s.cogsCount} POs)</p>
            <p>Operating Expenses: {fmtINR(s.operatingExpenses)} ({s.operatingExpensesCount} entries)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Net Profit</p>
          <p className={`text-2xl font-bold mt-2 ${s.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {s.netProfit >= 0 ? '+' : ''}{fmtINR(s.netProfit)}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            {s.totalIncome > 0 ? `Margin: ${((s.netProfit / s.totalIncome) * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Monthly Breakdown */}
      {data.monthly?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Monthly Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Month</th>
                  <th className="text-right px-4 py-3 font-medium">Invoice Revenue</th>
                  <th className="text-right px-4 py-3 font-medium">Other Income</th>
                  <th className="text-right px-4 py-3 font-medium">Total Income</th>
                  <th className="text-right px-4 py-3 font-medium">COGS</th>
                  <th className="text-right px-4 py-3 font-medium">Op. Expenses</th>
                  <th className="text-right px-4 py-3 font-medium">Total Expenses</th>
                  <th className="text-right px-4 py-3 font-medium">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.monthly.map((row) => {
                  const ti = row.invoiceRevenue + row.otherIncome;
                  const te = row.cogs + row.operatingExpenses;
                  const np = ti - te;
                  return (
                    <tr key={row.month} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-900 font-medium whitespace-nowrap">{formatMonth(row.month)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtINR(row.invoiceRevenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtINR(row.otherIncome)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmtINR(ti)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtINR(row.cogs)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtINR(row.operatingExpenses)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{fmtINR(te)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${np >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {np >= 0 ? '+' : ''}{fmtINR(np)}
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-gray-50 font-semibold text-sm">
                  <td className="px-5 py-3 text-gray-900 whitespace-nowrap">Total</td>
                  <td className="px-4 py-3 text-right text-gray-900">{fmtINR(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{fmtINR(s.otherIncome)}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{fmtINR(s.totalIncome)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{fmtINR(s.cogs)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{fmtINR(s.operatingExpenses)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{fmtINR(s.totalExpenses)}</td>
                  <td className={`px-4 py-3 text-right ${s.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {s.netProfit >= 0 ? '+' : ''}{fmtINR(s.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Income Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Income Sources</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Invoice Revenue</p>
                <p className="text-xs text-gray-400">{s.revenueCount} paid invoices</p>
              </div>
              <p className="text-sm font-semibold text-emerald-600">{fmtINR(s.revenue)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Other Income</p>
                <p className="text-xs text-gray-400">{s.otherIncomeCount} entries</p>
              </div>
              <p className="text-sm font-semibold text-emerald-600">{fmtINR(s.otherIncome)}</p>
            </div>
            <div className="flex justify-between items-center py-2">
              <p className="text-sm font-bold text-gray-900">Total Income</p>
              <p className="text-sm font-bold text-emerald-700">{fmtINR(s.totalIncome)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Expense Sources</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Cost of Goods Sold</p>
                <p className="text-xs text-gray-400">{s.cogsCount} received POs</p>
              </div>
              <p className="text-sm font-semibold text-red-600">{fmtINR(s.cogs)}</p>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Operating Expenses</p>
                <p className="text-xs text-gray-400">{s.operatingExpensesCount} entries</p>
              </div>
              <p className="text-sm font-semibold text-red-600">{fmtINR(s.operatingExpenses)}</p>
            </div>
            <div className="flex justify-between items-center py-2">
              <p className="text-sm font-bold text-gray-900">Total Expenses</p>
              <p className="text-sm font-bold text-red-700">{fmtINR(s.totalExpenses)}</p>
            </div>
          </div>
        </div>
      </div>

      {!data.monthly?.length && !s?.totalIncome && !s?.totalExpenses && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <EmptyState icon="📊" title="No data available" message="No data available for the selected period." />
        </div>
      )}
    </div>
  );
}
