import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area } from 'recharts';

const fmtINR = n => n || n === 0 ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
const fmtMonth = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

export default function RevenueAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(24);

  useEffect(() => {
    setLoading(true);
    superService.getAnalyticsRevenue().then(d => setData(d)).catch(() => {}).finally(() => setLoading(false));
  }, [months]);

  if (loading || !data) return <div className="text-center py-12 text-gray-400 text-sm">Loading revenue analytics...</div>;

  const revenueChart = data.revenueByMonth?.map(r => ({ month: fmtMonth(r.month), revenue: Number(r.revenue) || 0 })) || [];
  const planPie = data.revenueByPlan?.map(r => ({ name: r.plan_name || r.plan_id, value: Number(r.revenue) || 0 })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Revenue Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtINR(data.totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This Month</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtINR(data.thisMonthRevenue)}</p>
          {data.prevMonthRevenue > 0 && <p className="text-[10px] text-gray-400 mt-0.5">Prev: {fmtINR(data.prevMonthRevenue)}</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">MRR</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{fmtINR(data.mrr)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">ARR</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{fmtINR(data.arr)}</p>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        {revenueChart.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No revenue data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueChart}>
              <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
              <Tooltip formatter={v => fmtINR(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
          {planPie.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No plan revenue data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={planPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {planPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtINR(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {data.revenueByPlan?.map((p, i) => (
                  <div key={p.plan_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{p.plan_name || p.plan_id}</span>
                    <span className="font-medium text-gray-900">{fmtINR(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Revenue by Billing Cycle */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Billing Cycle</h3>
          {data.revenueByCycle?.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No billing cycle data</div>
          ) : (
            <div className="space-y-3">
              {data.revenueByCycle?.map(c => (
                <div key={c.period} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">{c.period}</p>
                    <p className="text-xs text-gray-400">{c.count} payments</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{fmtINR(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Campaign Revenue */}
      {data.campaignRevenue?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Campaign Revenue Impact</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Campaign</th>
                  <th className="table-header">Code</th>
                  <th className="table-header">Redemptions</th>
                  <th className="table-header">Discount Given</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.campaignRevenue.map(c => (
                  <tr key={c.name} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{c.name}</td>
                    <td className="table-cell">{c.code ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.code}</span> : '—'}</td>
                    <td className="table-cell">{c.redemptions}</td>
                    <td className="table-cell">{fmtINR(c.discount_given)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
