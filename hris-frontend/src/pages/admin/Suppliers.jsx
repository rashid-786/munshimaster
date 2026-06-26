import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import ConfirmModal from '../../components/ConfirmModal';
import { formatPhone } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const emptyForm = { name: '', contact_person: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', gstin: '', payment_terms: '', notes: '' };

const Suppliers = () => {
  const isMobile = useIsMobile();
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const limit = 200;
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrService.getSuppliers({ search, page, limit });
      setSuppliers(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (s) => { setEditing(s.id); setForm(s); setShowForm(true); setSelectedRecord(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await hrService.updateSupplier(editing, form);
      } else {
        await hrService.createSupplier(form);
      }
      setShowForm(false);
      setEditing(null);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save supplier.');
    } finally { setSaving(false); }
  };

  const handleDeactivate = (id, name) => {
    setModal({
      id, name,
      variant: 'warning',
      title: 'Deactivate Supplier',
      message: `Deactivate "${name}"? They will be marked as inactive.`,
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deactivateSupplier(id);
          setModal(null);
          fetch();
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to deactivate supplier.');
          setModal(null);
        } finally { setModalLoading(false); }
      },
    });
  };

  const handleActivate = async (id) => {
    try {
      await hrService.activateSupplier(id);
      fetch();
    } catch (err) { setError(err.response?.data?.error || 'Failed to activate supplier.'); }
  };

  const handleDelete = (id, name) => {
    setModal({
      id, name,
      variant: 'danger',
      title: 'Delete Supplier',
      message: `Permanently delete "${name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deleteSupplier(id);
          setModal(null);
          fetch();
        } catch (err) {
          setError(err.response?.data?.error || 'Delete failed.');
          setModal(null);
        } finally { setModalLoading(false); }
      },
    });
  };

  const totalPages = Math.ceil(total / limit);

  const columns = [
    { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'contact_person', label: 'Contact', render: (v) => <span className="text-gray-500">{v || '—'}</span> },
    { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '—' },
    { key: 'email', label: 'Email', render: (v) => v || '—' },
    { key: 'city', label: 'City', render: (v) => v || '—' },
    { key: 'gstin', label: 'GSTIN', render: (v) => <span className="text-xs font-mono">{v || '—'}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={v === 'active' ? 'badge-success' : 'badge-danger'}>{v}</span> },
    { key: 'actions', label: 'Actions', render: (_, s) => (
      <div className="flex gap-1.5 justify-end">
        <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
        {s.status === 'active' ? (
          <button onClick={(e) => { e.stopPropagation(); handleDeactivate(s.id, s.name); }} className="btn-warning !py-1 !px-3 text-xs">Deactivate</button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); handleActivate(s.id); }} className="btn-success !py-1 !px-3 text-xs">Activate</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }} className="btn-danger !py-1 !px-3 text-xs">Delete</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
      </div>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Suppliers</h2>
        <button onClick={openCreate} className="btn-primary">+ Add Supplier</button>
      </div>

      <ResponsiveTable
        columns={columns}
        data={suppliers}
        keyField="id"
        searchable={true}
        searchKeys={['name', 'contact_person', 'email', 'phone']}
        loading={loading}
        mobilePrimary="name"
        mobileSecondary="status"
        onRowClick={(s) => setSelectedRecord(s)}
        emptyMessage="No suppliers found"
        header={
          <input type="text" placeholder="Search by name, contact, email or phone..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field" />
        }
        total={total} page={page} totalPages={totalPages}
        onPrevPage={() => setPage(p => p - 1)}
        onNextPage={() => setPage(p => p + 1)}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => { setShowForm(false); setEditing(null); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                    <input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                    <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} className="input-field" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" rows={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                    <input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. Net 30" className="input-field" />
                  </div>
                  {editing && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-field">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
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

      {isMobile && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={selectedRecord?.name || 'Supplier Details'}
          actions={
            <>
              <button
                onClick={() => { const r = selectedRecord; setSelectedRecord(null); openEdit(r); }}
                className="flex-1 btn-primary justify-center"
              >
                Edit
              </button>
              {selectedRecord?.status === 'active' ? (
                <button
                  onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDeactivate(r.id, r.name); }}
                  className="flex-1 btn-warning justify-center"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleActivate(r.id); }}
                  className="flex-1 btn-success justify-center"
                >
                  Activate
                </button>
              )}
              <button
                onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDelete(r.id, r.name); }}
                className="flex-1 btn-danger justify-center"
              >
                Delete
              </button>
            </>
          }
        >
          {selectedRecord && (
            <div className="space-y-3">
              <DetailRow label="Name" value={selectedRecord.name} />
              <DetailRow label="Contact Person" value={selectedRecord.contact_person} />
              <DetailRow label="Phone" value={formatPhone(selectedRecord.phone)} />
              <DetailRow label="Email" value={selectedRecord.email} />
              <DetailRow label="City" value={selectedRecord.city} />
              <DetailRow label="State" value={selectedRecord.state} />
              <DetailRow label="Pincode" value={selectedRecord.pincode} />
              <DetailRow label="GSTIN" value={selectedRecord.gstin} />
              <DetailRow label="Status">
                <span className={selectedRecord.status === 'active' ? 'badge-success' : 'badge-danger'}>{selectedRecord.status}</span>
              </DetailRow>
              <DetailRow label="Payment Terms" value={selectedRecord.payment_terms} />
              <DetailRow label="Address" value={selectedRecord.address} />
              <DetailRow label="Notes" value={selectedRecord.notes} />
            </div>
          )}
        </BottomSheet>
      )}
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

export default Suppliers;
