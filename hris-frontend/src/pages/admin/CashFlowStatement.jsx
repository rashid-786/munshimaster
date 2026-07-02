import React, { useState, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const getMonthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const getToday = () => new Date().toISOString().slice(0, 10);

const StatCard = ({ label, value, color = 'text-gray-800', sub }) => (
  <div className="bg-white rounded-xl border p-4">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{value ?? '-'}</p>
    {sub != null && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const CashFlowStatement = () => {
  const [from, setFrom] = useState(getMonthStart());
  const [to, setTo] = useState(getToday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await hrService.getCashFlow(from, to);
      setData(res);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load cash flow.');
    } finally { setLoading(false); }
  }, [from, to]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Cash Flow Statement</h2>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={fetchData} disabled={loading}
          className="mt-5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
          {loading ? 'Loading...' : 'Generate'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {loading && <Loading />}

      {!loading && data && (
        <div className="space-y-6">
          {data.companyName && (
            <p className="text-sm text-gray-500 font-medium">{data.companyName} — {data.period?.from} to {data.period?.to}</p>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">Operating Activities</h3>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Collections from Customers</span>
                <span className="font-medium text-emerald-600">₹{(data.summary?.collectionsFromCustomers || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Other Income</span>
                <span className="font-medium text-emerald-600">₹{(data.summary?.otherIncome || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm py-1">
                <span className="text-gray-700 font-medium">Total Cash In</span>
                <span className="font-bold text-emerald-700">₹{(data.summary?.totalCashIn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Payments to Suppliers & Expenses</span>
                <span className="font-medium text-red-600">₹{(data.summary?.totalCashOut || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t-2 pt-2 flex justify-between text-sm py-1">
                <span className="text-gray-800 font-semibold">Net Cash from Operations</span>
                <span className={`font-bold ${(data.summary?.operatingNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  ₹{(data.summary?.operatingNet || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">Financing Activities</h3>
            </div>
            <div className="p-4">
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-600">Subscription Payments Received</span>
                <span className="font-medium text-emerald-600">₹{(data.summary?.financingNet || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm py-1">
                <span className="text-gray-800 font-semibold">Net Cash from Financing</span>
                <span className="font-bold text-emerald-700">₹{(data.summary?.financingNet || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
              <StatCard label="Operating Net" value={`₹${(data.summary?.operatingNet || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                color={(data.summary?.operatingNet || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} />
              <StatCard label="Financing Net" value={`₹${(data.summary?.financingNet || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                color="text-blue-700" />
              <StatCard label="Net Cash Flow" value={`₹${(data.summary?.netCashFlow || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                color={(data.summary?.netCashFlow || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} />
              <StatCard label="Bank Credits" value={`₹${(data.bankSummary?.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                color="text-gray-600" sub={`Debits: ₹${(data.bankSummary?.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            </div>
          </div>

          {data.monthlyTrend?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-800">Monthly Trend</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2">Month</th>
                      <th className="text-right px-4 py-2">Collections</th>
                      <th className="text-right px-4 py-2">Cash In</th>
                      <th className="text-right px-4 py-2">Cash Out</th>
                      <th className="text-right px-4 py-2">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.monthlyTrend.map((m, i) => {
                      const net = (m.cashIn || 0) - (m.cashOut || 0);
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{m.month}</td>
                          <td className="px-4 py-2 text-right">₹{(m.collections || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2 text-right text-emerald-600">₹{(m.cashIn || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2 text-right text-red-600">₹{(m.cashOut || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className={`px-4 py-2 text-right font-medium ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CashFlowStatement;
