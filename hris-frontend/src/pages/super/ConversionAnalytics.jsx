import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmtINR = n => n || n === 0 ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
const fmtPct = n => n || n === 0 ? Number(n).toFixed(1) + '%' : '—';
const ARROW_UP = '↑';
const ARROW_DOWN = '↓';

const BAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ConversionAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    superService.getAnalyticsConversion()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="text-center py-12 text-gray-400 text-sm">Loading conversion analytics...</div>;

  const funnel = data.conversionFunnel || [];
  const trialConversionRate = data.trialConversionRate || 0;
  const sourceData = data.conversionBySource || [];
  const planData = data.conversionByPlan || [];
  const periodData = data.conversionByPeriod || [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Conversion Analytics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Trial → Paid</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtPct(trialConversionRate)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Overall conversion rate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Trials</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalTrials || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Converted</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{data.convertedCount || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Days to Convert</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{data.avgDaysToConvert ? Math.round(data.avgDaysToConvert) + 'd' : '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          {funnel.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No funnel data</div>
          ) : (
            <div className="space-y-2">
              {funnel.map((s, i) => {
                const maxCount = Math.max(...funnel.map(f => f.count || 0));
                const pct = maxCount > 0 ? ((s.count || 0) / maxCount) * 100 : 0;
                return (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{s.stage}</span>
                      <span className="font-medium text-gray-900">{s.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${i === 0 ? 'bg-indigo-500' : i === funnel.length - 1 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${pct}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Conversion by Source */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion by Source</h3>
          {sourceData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No source data</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sourceData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="source" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="trials" fill="#a5b4fc" name="Trials" stackId="a" />
                <Bar dataKey="converted" fill="#6366f1" name="Converted" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Conversion by Period */}
      {periodData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => v + '%'} domain={[0, 100]} />
              <Tooltip formatter={(v, n) => n === 'rate' ? v + '%' : v} />
              <Bar yAxisId="left" dataKey="trials" fill="#a5b4fc" name="Trials" />
              <Bar yAxisId="left" dataKey="converted" fill="#6366f1" name="Converted" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conversion by Plan */}
      {planData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion by Target Plan</h3>
          <div className="space-y-3">
            {planData.map(p => (
              <div key={p.plan_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">{p.plan_name}</p>
                  <p className="text-xs text-gray-400">{p.converted} converted of {p.trials} trials</p>
                </div>
                <span className="text-sm font-bold text-emerald-600">{fmtPct(p.conversion_rate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retention Metrics */}
      {data.retentionMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">30-Day Retention</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{fmtPct(data.retentionMetrics.d30)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">60-Day Retention</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{fmtPct(data.retentionMetrics.d60)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">90-Day Retention</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtPct(data.retentionMetrics.d90)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Churn Rate</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{fmtPct(data.retentionMetrics.churnRate)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
