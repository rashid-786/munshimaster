import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
const fmtPct = n => n || n === 0 ? Number(n).toFixed(1) + '%' : '—';

export default function PlanAdoption() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    superService.getAnalyticsPlanAdoption()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="text-center py-12 text-gray-400 text-sm">Loading plan adoption analytics...</div>;

  const planDist = data.planDistribution || [];
  const switchData = data.planSwitches || [];
  const upgradeData = data.upgradePath || [];
  const activeTenants = data.activeTenants || 0;
  const paidTenants = data.paidTenants || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Plan Adoption & Distribution</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active Tenants</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{activeTenants}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Paid Tenants</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{paidTenants}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Free / Trial</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{data.freeTrialTenants || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Paid %</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{activeTenants > 0 ? fmtPct((paidTenants / activeTenants) * 100) : '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Plan Distribution</h3>
          {planDist.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No plan distribution data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" outerRadius={100} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [v, 'Tenants']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {planDist.map((p, i) => (
                  <div key={p.name || p.plan_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{p.name || p.plan_id}</span>
                    <span className="font-medium text-gray-900">{p.count} ({fmtPct(p.percentage)})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Plan Switches */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Plan Switches (Last 12 Months)</h3>
          {switchData.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No switch data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={switchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="upgrades" fill="#10b981" name="Upgrades" stackId="a" />
                <Bar dataKey="downgrades" fill="#f59e0b" name="Downgrades" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Upgrade Paths */}
      {upgradeData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Common Upgrade Paths</h3>
          <div className="space-y-3">
            {upgradeData.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{p.from_plan} → {p.to_plan}</span>
                  <span className="text-xs text-gray-400">({p.count} tenants)</span>
                </div>
                <span className="text-xs text-emerald-600 font-medium">{fmtPct(p.percentage)} of upgrades</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
