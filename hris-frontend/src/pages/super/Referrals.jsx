import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const classNames = (...c) => c.filter(Boolean).join(' ');

const StatusBadge = ({ status }) => {
  const styles = { pending: 'bg-amber-100 text-amber-700', credited: 'bg-emerald-100 text-emerald-700', expired: 'bg-gray-100 text-gray-500' };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.expired}`}>{status}</span>;
};

export default function ReferralsPage() {
  const [summary, setSummary] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        superService.getReferralSummary().catch(() => null),
        superService.listReferrals({ page, limit: 50, status: statusFilter || undefined, search: search || undefined }),
      ]);
      if (s) setSummary(s);
      setReferrals(r.referrals || []);
      setTotalPages(r.totalPages || 1);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load referrals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [page, statusFilter]);

  const handleSearch = () => { setPage(1); fetchAll(); };

  const handleMarkCredited = async r => {
    try {
      await superService.updateReferralStatus(r.id, { status: 'credited' });
      fetchAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update.');
    }
  };

  const StatCard = ({ label, value, sub }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Referrals</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track referral performance and conversions</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Referrals" value={summary.total} />
          <StatCard label="Pending" value={summary.pending} />
          <StatCard label="Credited" value={summary.credited} />
          <StatCard label="Converted" value={summary.converted} sub={`${summary.conversionRate}% rate`} />
          <StatCard label="Revenue Generated" value={`₹${(summary.totalRevenue || 0).toLocaleString('en-IN')}`} />
          <StatCard label="Top Referrers" value={summary.topReferrers?.length || 0} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {['', 'pending', 'credited', 'expired'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={classNames('text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
                statusFilter === s ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              )}
            >{s || 'All'}</button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company..."
            className="input-field text-sm py-1.5 px-3 w-48" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <button onClick={handleSearch} className="btn-secondary !py-1.5 text-sm">Search</button>
        </div>
      </div>

      {/* Referral list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No referrals found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Referrer</th>
                  <th className="table-header">Referred</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Converted</th>
                  <th className="table-header">Revenue</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {referrals.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-medium text-gray-900">{r.referrer_name || r.referrer_id?.slice(0,8)}</p>
                      <p className="text-[10px] text-gray-400">{r.referrer_subdomain}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-gray-700">{r.referred_name || r.referred_id?.slice(0,8)}</p>
                      <p className="text-[10px] text-gray-400">{r.referred_subdomain}</p>
                    </td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell">
                      <span className={r.converted ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                        {r.converted ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-600">
                      {r.revenue_generated ? `₹${r.revenue_generated.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="table-cell text-gray-500 whitespace-nowrap text-xs">{fmtDate(r.created_at)}</td>
                    <td className="table-cell text-right">
                      {r.status === 'pending' && (
                        <button onClick={() => handleMarkCredited(r)} className="btn-secondary !py-1 !px-2 text-xs">Mark Credited</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Top referrers */}
      {summary?.topReferrers?.length > 0 && (
        <details className="bg-white rounded-lg border border-gray-200">
          <summary className="px-6 py-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">Top Referrers ({summary.topReferrers.length})</summary>
          <div className="px-6 py-3 border-t border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="pb-2 pr-2">Company</th>
                  <th className="pb-2 pr-2">Plan</th>
                  <th className="pb-2 pr-2">Referrals</th>
                  <th className="pb-2 pr-2">Converted</th>
                  <th className="pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {summary.topReferrers.map(t => (
                  <tr key={t.referrer_id}>
                    <td className="py-1.5 pr-2 font-medium text-gray-700">{t.company_name}</td>
                    <td className="py-1.5 pr-2 text-gray-500 text-xs">{t.subscription_plan}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{t.total}</td>
                    <td className="py-1.5 pr-2 text-gray-700">{t.converted}</td>
                    <td className="py-1.5 text-gray-700">₹{(t.revenue || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
