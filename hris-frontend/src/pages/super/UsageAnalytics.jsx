import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmtINR = n => n || n === 0 ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
const fmtPct = n => n || n === 0 ? Number(n).toFixed(1) + '%' : '—';

export default function UsageAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    superService.getAnalyticsUsage()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="text-center py-12 text-gray-400 text-sm">Loading usage analytics...</div>;

  const moduleUsage = data.moduleUsage || [];
  const topTenants = data.topTenants || [];
  const usageTrend = data.usageTrend || [];

  const avgApiCalls = data.avgApiCalls || 0;
  const avgStorage = data.avgStorage || 0;
  const totalApiCalls = data.totalApiCalls || 0;
  const totalStorage = data.totalStorage || 0;
  const peakApiCalls = data.peakApiCalls || 0;

  const formatBytes = bytes => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Usage Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total API Calls</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalApiCalls.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg per Tenant</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{avgApiCalls.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Peak API Calls</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{peakApiCalls.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Storage</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatBytes(totalStorage)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Usage Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Module Usage</h3>
          {moduleUsage.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No module usage data</div>
          ) : (
            <ResponsiveContainer width="100%" height={moduleUsage.length * 40 + 40}>
              <BarChart data={moduleUsage} layout="vertical" margin={{ left: 100, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="module" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={v => v.toLocaleString('en-IN')} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Usage Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage Trend (Last 12 Months)</h3>
          {usageTrend.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No trend data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={usageTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v} />
                <Tooltip formatter={v => v.toLocaleString('en-IN')} />
                <Bar dataKey="api_calls" fill="#6366f1" name="API Calls" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Tenants by Usage */}
      {topTenants.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">Top Tenants by API Usage</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">#</th>
                  <th className="table-header">Company</th>
                  <th className="table-header">Plan</th>
                  <th className="table-header">API Calls</th>
                  <th className="table-header">Storage</th>
                  <th className="table-header">Active Users</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topTenants.map((t, i) => (
                  <tr key={t.tenant_id || i} className="hover:bg-gray-50">
                    <td className="table-cell text-gray-400">{i + 1}</td>
                    <td className="table-cell font-medium">{t.company_name || t.tenant_id}</td>
                    <td className="table-cell"><span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{t.plan_name || t.plan_id}</span></td>
                    <td className="table-cell">{t.api_calls?.toLocaleString('en-IN') || 0}</td>
                    <td className="table-cell">{formatBytes(t.storage_bytes)}</td>
                    <td className="table-cell">{t.active_users || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Storage Breakdown */}
      {data.storageByModule?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Storage by Module</h3>
          <div className="space-y-3">
            {data.storageByModule.map(s => (
              <div key={s.module} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.module}</span>
                  <span className="font-medium text-gray-900">{formatBytes(s.bytes)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${s.percentage || 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
