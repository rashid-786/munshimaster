import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import SearchableSelect from '../../components/SearchableSelect';
import useIsMobile from '../../hooks/useIsMobile';

const Replacements = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin';
  const [replacements, setReplacements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form, setForm] = useState({ permanentEmployeeId: '', adhocEmployeeId: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [replacements, employees] = await Promise.all([
          hrService.getReplacements({ status: filterStatus || undefined }),
          hrService.getEmployees(true),
        ]);
        setReplacements(replacements);
        setEmployees(employees);
      } catch (err) {
        setError('Failed to load replacements.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [filterStatus]);

  const permEmployees = useMemo(() =>
    employees.filter(e => e.job_type === 'permanent' && e.status !== 'deactivated')
      .map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
    [employees]
  );

  const adhocEmployees = useMemo(() =>
    employees.filter(e => e.job_type === 'adhoc' && e.status !== 'deactivated')
      .map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
    [employees]
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.createReplacement(form);
      setMessage(res.message);
      setShowCreate(false);
      setForm({ permanentEmployeeId: '', adhocEmployeeId: '', startDate: '', endDate: '' });
      setReplacements(await hrService.getReplacements());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create replacement.');
    }
  };

  const handleEnd = (id) => {
    setModal({
      id,
      variant: 'warning',
      title: 'End Replacement',
      message: 'Mark this replacement as completed? The adhoc staff will be freed for new assignments.',
      confirmLabel: 'End Replacement',
      onConfirm: async () => {
        setModalLoading(true);
        try { await hrService.endReplacement(id); setModal(null); setReplacements(await hrService.getReplacements()); }
        catch (err) { setError(err.response?.data?.error || 'Failed to end replacement.'); setModal(null); }
        finally { setModalLoading(false); }
      },
    });
  };

  const handleDelete = (id) => {
    setModal({
      id,
      variant: 'danger',
      title: 'Delete Replacement',
      message: 'Permanently delete this replacement record? This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try { await hrService.deleteReplacement(id); setModal(null); setReplacements(await hrService.getReplacements()); }
        catch (err) { setError(err.response?.data?.error || 'Failed to delete.'); setModal(null); }
        finally { setModalLoading(false); }
      },
    });
  };

  const filteredReplacements = useMemo(() => {
    let result = replacements;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        `${r.permanent_first_name} ${r.permanent_last_name}`.toLowerCase().includes(q) ||
        `${r.adhoc_first_name} ${r.adhoc_last_name}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [replacements, search]);

  const statusBadge = (s) => s === 'active' ? 'badge-success' : 'badge-info';

  const columns = [
    { key: 'permanent', label: 'Permanent Staff', render: (_, r) => <span className="font-medium">{r.permanent_first_name} {r.permanent_last_name}</span> },
    { key: 'adhoc', label: 'Replacement (Adhoc)', render: (_, r) => <span>{r.adhoc_first_name} {r.adhoc_last_name}</span> },
    { key: 'start_date', label: 'From', render: (v) => <span className="text-gray-500">{v ? new Date(v).toLocaleDateString() : '—'}</span> },
    { key: 'end_date', label: 'To', render: (v) => <span className="text-gray-500">{v ? new Date(v).toLocaleDateString() : '—'}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={statusBadge(v)}>{v}</span> },
    { key: 'actions', label: 'Actions', render: (_, r) => (
      <div className="flex gap-1.5">
        {r.status === 'active' && (
          <button onClick={(e) => { e.stopPropagation(); handleEnd(r.id); }} className="btn-warning !py-1 !px-2.5 text-xs">End</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="btn-ghost !py-1 !px-2.5 text-xs !text-red-500 hover:!bg-red-50" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    )},
  ];

  if (!isAdmin) {
    return <div className="text-gray-500 text-center py-12 text-sm">Access denied. Admin only.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-4 shrink-0">&times;</button>
        </div>
      )}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-500 hover:text-emerald-700 ml-4 shrink-0">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total', count: replacements.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active', count: replacements.filter(r => r.status === 'active').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Completed', count: replacements.filter(r => r.status === 'completed').length, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center ${s.color} shrink-0`}>
              <span className="text-lg font-bold">{s.count}</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">{s.label} Replacements</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active timeline */}
      {replacements.some(r => r.status === 'active') && (
        <div className="card p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Active Replacements Timeline</h4>
          <div className="space-y-3">
            {replacements.filter(r => r.status === 'active').map(r => {
              const today = new Date();
              const start = new Date(r.start_date);
              const end = new Date(r.end_date);
              const total = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
              const elapsed = Math.max(0, Math.min(total, (today - start) / (1000 * 60 * 60 * 24)));
              const pct = Math.round((elapsed / total) * 100);
              return (
                <div key={r.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{r.adhoc_first_name} {r.adhoc_last_name}</p>
                    <p className="text-xs text-gray-500">covering {r.permanent_first_name} {r.permanent_last_name}</p>
                  </div>
                  <div className="text-xs text-gray-400 w-20 text-right">{new Date(r.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 w-20">{new Date(r.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  <span className="text-xs font-medium text-gray-500 w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Staff Replacements</h3>
              <p className="text-sm text-gray-500 mt-0.5">Track adhoc staff covering for permanent employees on leave.</p>
            </div>
            <button onClick={() => { setForm({ permanentEmployeeId: '', adhocEmployeeId: '', startDate: '', endDate: '' }); setShowCreate(true); }} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Replacement
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[140px] max-w-[200px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-8 text-sm"
            />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field max-w-[130px] text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <span className="text-xs text-gray-400">{filteredReplacements.length} replacement{filteredReplacements.length !== 1 ? 's' : ''}</span>
        </div>

        <ResponsiveTable
          columns={columns}
          data={filteredReplacements}
          keyField="id"
          searchKeys={['permanent_first_name', 'permanent_last_name', 'adhoc_first_name', 'adhoc_last_name', 'status']}
          loading={loading}
          mobilePrimary="permanent"
          mobileSecondary="status"
          onRowClick={(r) => setSelectedRecord(r)}
          emptyMessage="No replacements found"
        />

        {isMobile && (
          <BottomSheet
            open={!!selectedRecord}
            onClose={() => setSelectedRecord(null)}
            title="Replacement Details"
            actions={
              selectedRecord?.status === 'active' ? (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleEnd(r.id); }} className="flex-1 btn-warning justify-center">End</button>
              ) : null
            }
          >
            {selectedRecord && (
              <div className="space-y-3">
                <DetailRow label="Permanent" value={`${selectedRecord.permanent_first_name} ${selectedRecord.permanent_last_name}`} />
                <DetailRow label="Replacement" value={`${selectedRecord.adhoc_first_name} ${selectedRecord.adhoc_last_name}`} />
                <DetailRow label="From" value={new Date(selectedRecord.start_date).toLocaleDateString()} />
                <DetailRow label="To" value={new Date(selectedRecord.end_date).toLocaleDateString()} />
                <DetailRow label="Status">
                  <span className={statusBadge(selectedRecord.status)}>{selectedRecord.status}</span>
                </DetailRow>
                {selectedRecord.leave_type && (
                  <DetailRow label="Leave Type" value={selectedRecord.leave_type} />
                )}
              </div>
            )}
          </BottomSheet>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">New Replacement</h3>
                <p className="text-sm text-gray-500 mt-0.5">Assign adhoc staff to cover for a permanent employee.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permanent Staff (on leave)</label>
                <SearchableSelect
                  options={permEmployees}
                  value={form.permanentEmployeeId}
                  onChange={(val) => setForm({ ...form, permanentEmployeeId: val })}
                  placeholder="Select permanent staff..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adhoc Replacement</label>
                <SearchableSelect
                  options={adhocEmployees}
                  value={form.adhocEmployeeId}
                  onChange={(val) => setForm({ ...form, adhocEmployeeId: val })}
                  placeholder="Select adhoc staff..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required className="input-field" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Replacement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!modal}
        title={modal?.title}
        message={modal?.message}
        confirmLabel={modal?.confirmLabel}
        variant={modal?.variant}
        loading={modalLoading}
        onConfirm={modal?.onConfirm || (() => {})}
        onCancel={() => setModal(null)}
      />
    </div>
  );
};

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default Replacements;
