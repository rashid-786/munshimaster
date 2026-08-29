import { useState, useEffect, useCallback } from 'react';
import { superService } from '../../services/super.service';

const STATUS_BADGE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AccountDeletionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [message, setMessage] = useState(null);
  const [action, setAction] = useState(null); // { type: 'approve' | 'reject', request }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const notify = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const load = useCallback(async (status) => {
    setLoading(true);
    try {
      const res = await superService.listAccountDeletionRequests({ status });
      setRequests(res.requests || []);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Failed to load deletion requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const confirmAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.type === 'approve') {
        await superService.approveAccountDeletion(action.request.id, note);
        notify('success', `Account "${action.request.company_name || action.request.tenant_id}" deleted permanently.`);
      } else {
        await superService.rejectAccountDeletion(action.request.id, note);
        notify('success', 'Request rejected. The account remains active.');
      }
      setAction(null);
      setNote('');
      load(filter);
    } catch (err) {
      notify('error', err.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v) => v ? new Date(v).toLocaleString() : '—';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Deletion Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Review tenant requests to delete their accounts, per the Account Deletion Policy.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              filter === f.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-gray-500">No {filter === 'all' ? '' : filter + ' '}deletion requests.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="p-3 font-semibold">Business</th>
                <th className="p-3 font-semibold">Phone</th>
                <th className="p-3 font-semibold">Requested By</th>
                <th className="p-3 font-semibold">Reason</th>
                <th className="p-3 font-semibold">Requested At</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="p-3 font-medium">{r.company_name || '—'}</td>
                  <td className="p-3">{r.phone || '—'}</td>
                  <td className="p-3">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="p-3 max-w-[260px] text-gray-600">{r.reason || '—'}</td>
                  <td className="p-3 text-gray-500">{fmt(r.requested_at)}</td>
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[r.status] || STATUS_BADGE.pending}`}>
                      {r.status}
                    </span>
                    {r.reviewed_at && (
                      <p className="text-[11px] text-gray-400 mt-1">by {r.reviewed_by} · {fmt(r.reviewed_at)}</p>
                    )}
                  </td>
                  <td className="p-3">
                    {r.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setAction({ type: 'approve', request: r }); setNote(''); }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
                        >
                          Approve & Delete
                        </button>
                        <button
                          onClick={() => { setAction({ type: 'reject', request: r }); setNote(''); }}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{r.review_note || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation panel */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${action.type === 'approve' ? 'bg-red-100' : 'bg-amber-100'}`}>
                  {action.type === 'approve' ? (
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {action.type === 'approve' ? 'Approve & Delete Account' : 'Reject Request'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {action.type === 'approve'
                      ? `This will permanently delete "${action.request.company_name || action.request.tenant_id}" and all of its data. This cannot be undone.`
                      : `Keep "${action.request.company_name || action.request.tenant_id}" active and dismiss this request.`}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-gray-600">Review note (optional)</label>
                <textarea
                  className="input-field mt-1"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note for the record"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setAction(null)} disabled={busy} className="btn-secondary !py-2 !px-4 text-sm">
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={busy}
                className={`${action.type === 'approve' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'} !py-2 !px-4 text-sm font-semibold rounded-lg disabled:opacity-50`}
              >
                {busy ? (action.type === 'approve' ? 'Deleting...' : 'Rejecting...') : action.type === 'approve' ? 'Approve & Delete' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}