import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import ConfirmModal from '../../components/ConfirmModal';
import { formatINR, formatPhone } from '../../utils/currency';
import PhoneField from '../../components/PhoneInput';
import StateSelect from '../../components/StateSelect';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';
import UpgradeBanner from '../../components/UpgradeBanner';
import { ActionEdit, ActionDelete } from '../../components/ActionIcons';
import TransactionsTab from '../../components/TransactionsTab';

const TABS = ['Business Information', 'Credit Information', 'Address & Details'];

const emptyForm = {
  name: '', email: '', phone: '',
  gstin: '', pan: '',
  opening_balance: '', opening_balance_type: 'payable', credit_period: '', credit_limit: '',
  address: '', city: '', state: '', pincode: '',
  billing_address: '', billing_address_line2: '', billing_city: '', billing_state: '', billing_country: 'India', billing_postal_code: '',
  shipping_address: '', shipping_address_line2: '', shipping_city: '', shipping_state: '', shipping_country: 'India', shipping_postal_code: '',
  payment_terms: '', notes: '',
  sameAsBilling: false,
};

function validateGstin(v) {
  if (!v) return '';
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v) ? '' : 'Invalid GST format';
}

function validatePan(v) {
  if (!v) return '';
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v) ? '' : 'Invalid PAN format';
}

const Suppliers = () => {
  const isMobile = useIsMobile();
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const limit = 200;
  const [loading, setLoading] = useState(true);
  const [addressTab, setAddressTab] = useState('billing');
  const [detailTab, setDetailTab] = useState('details');

  useEffect(() => { setDetailTab('details'); }, [selectedRecord]);

  const setBillingField = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (prev.sameAsBilling && key.startsWith('billing_')) {
        const shipKey = 'shipping_' + key.slice(8);
        next[shipKey] = value;
      }
      return next;
    });
  };

  const handleSameAsBilling = (checked) => {
    setForm(prev => {
      if (checked) {
        return {
          ...prev,
          sameAsBilling: checked,
          shipping_address: prev.billing_address,
          shipping_address_line2: prev.billing_address_line2,
          shipping_city: prev.billing_city,
          shipping_state: prev.billing_state,
          shipping_country: prev.billing_country,
          shipping_postal_code: prev.billing_postal_code,
        };
      }
      return { ...prev, sameAsBilling: checked };
    });
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, page, limit };
      if (statusFilter) params.status = statusFilter;
      const res = await hrService.getSuppliers(params);
      setSuppliers(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, page, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormTab(0);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s.id);
    const cleaned = {};
    for (const key of Object.keys(emptyForm)) {
      let val = s[key] ?? '';
      if (key === 'opening_balance' || key === 'credit_limit') {
        val = val ? (val / 100).toFixed(2) : '';
      }
      cleaned[key] = val;
    }
    setForm(cleaned);
    setFormTab(0);
    setShowForm(true);
    setSelectedRecord(null);
  };

  const hasFormErrors = () => {
    const gstErr = validateGstin(form.gstin);
    const panErr = validatePan(form.pan);
    if (gstErr || panErr) {
      setError([gstErr, panErr].filter(Boolean).join('. '));
      return true;
    }
    return false;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (hasFormErrors()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.sameAsBilling;
      payload.opening_balance = Math.round(parseFloat(form.opening_balance || 0) * 100);
      payload.credit_limit = Math.round(parseFloat(form.credit_limit || 0) * 100);
      if (editing) {
        await hrService.updateSupplier(editing, payload);
      } else {
        await hrService.createSupplier(payload);
      }
      setShowForm(false);
      setEditing(null);
      setError('');
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
    { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '—' },
    { key: 'gstin', label: 'GSTIN', render: (v) => <span className="text-gray-500 text-xs font-mono">{v || '—'}</span> },
    { key: 'opening_balance', label: 'Opening Bal.', render: (v, r) => {
      if (!v) return '—';
      const amt = formatINR(v);
      return <span className={r.opening_balance_type === 'payable' ? 'text-red-600' : 'text-green-600'}>{amt}</span>;
    }},
    { key: 'credit_limit', label: 'Credit Limit', render: (v) => (v ? formatINR(v) : '—') },
    { key: 'status', label: 'Status', render: (v) => <span className={v === 'active' ? 'badge-success' : 'badge-danger'}>{v}</span> },
    { key: 'actions', label: 'Actions', className: 'text-right', render: (_, s) => (
      <div className="flex gap-1.5 justify-end">
        <ActionEdit onClick={(e) => { e.stopPropagation(); openEdit(s); }} />
        {s.status === 'active' ? (
          <button onClick={(e) => { e.stopPropagation(); handleDeactivate(s.id, s.name); }} className="btn-warning !py-1.5 !px-2.5 text-xs">Deactivate</button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); handleActivate(s.id); }} className="btn-success !py-1.5 !px-2.5 text-xs">Activate</button>
        )}
        <ActionDelete onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }} />
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
      </div>}
      <UpgradeBanner type="feature" feature="Suppliers" plan="business" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Suppliers</h2>
        <button onClick={openCreate} className="btn-primary">+ Add Supplier</button>
      </div>

      <ResponsiveTable
        columns={columns}
        data={suppliers}
        keyField="id"
        searchKeys={['name', 'email', 'phone', 'gstin', 'pan']}
        loading={loading}
        mobilePrimary="name"
        mobileSecondary="status"
        onRowClick={(s) => setSelectedRecord(s)}
        emptyMessage="No suppliers found"
        header={
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" placeholder="Search by name, GSTIN, PAN or phone..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-field flex-1 min-w-[180px]" />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="input-field max-w-[130px] text-sm">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        }
        total={total} page={page} totalPages={totalPages}
        onPrevPage={() => setPage(p => p - 1)}
        onNextPage={() => setPage(p => p + 1)}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 px-6">
                {TABS.map((t, i) => (
                  <button key={t} type="button"
                    onClick={() => setFormTab(i)}
                    className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${formTab === i ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-4">
                {formTab === 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Party Name *</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                      <PhoneField value={form.phone} onChange={v => setForm({ ...form, phone: v || '' })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                      <input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                        className="input-field" placeholder="22AAAAA0000A1Z5" maxLength={15} />
                      {form.gstin && validateGstin(form.gstin) && <p className="text-xs text-red-500 mt-1">{validateGstin(form.gstin)}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                      <input value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                        className="input-field" placeholder="AAAAA0000A" maxLength={10} />
                      {form.pan && validatePan(form.pan) && <p className="text-xs text-red-500 mt-1">{validatePan(form.pan)}</p>}
                    </div>

                  </div>
                )}

                {formTab === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                      <div className="flex gap-2">
                        <input type="number" step="0.01" value={form.opening_balance}
                          onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                          className="input-field flex-1" placeholder="0.00" />
                        <select value={form.opening_balance_type}
                          onChange={e => setForm({ ...form, opening_balance_type: e.target.value })}
                          className="input-field max-w-[130px] text-sm">
                          <option value="payable">Payable</option>
                          <option value="receivable">Receivable</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Payable = you owe, Receivable = they owe</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Period (days)</label>
                      <input type="number" min="0" value={form.credit_period}
                        onChange={e => setForm({ ...form, credit_period: e.target.value })}
                        className="input-field" placeholder="e.g. 30" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
                      <input type="number" step="0.01" min="0" value={form.credit_limit}
                        onChange={e => setForm({ ...form, credit_limit: e.target.value })}
                        className="input-field" placeholder="0.00" />
                    </div>
                  </div>
                )}

                {formTab === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 border-b border-gray-200 pb-2">
                      <button type="button"
                        onClick={() => setAddressTab('billing')}
                        className={`text-sm font-medium pb-2 -mb-[9px] border-b-2 transition-colors ${addressTab === 'billing' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>
                        Billing Address
                      </button>
                      <button type="button"
                        onClick={() => setAddressTab('shipping')}
                        className={`text-sm font-medium pb-2 -mb-[9px] border-b-2 transition-colors ${addressTab === 'shipping' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>
                        Shipping Address
                      </button>
                    </div>

                    {addressTab === 'billing' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                          <textarea value={form.billing_address} onChange={e => setBillingField('billing_address', e.target.value)}
                            className="input-field" rows={2} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                          <input value={form.billing_address_line2} onChange={e => setBillingField('billing_address_line2', e.target.value)}
                            className="input-field" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                          <input value={form.billing_city} onChange={e => setBillingField('billing_city', e.target.value)}
                            className="input-field" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                          <StateSelect value={form.billing_state} onChange={v => setBillingField('billing_state', v)} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                          <input value={form.billing_country} onChange={e => setBillingField('billing_country', e.target.value)}
                            className="input-field" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                          <input value={form.billing_postal_code} onChange={e => setBillingField('billing_postal_code', e.target.value)}
                            className="input-field" />
                        </div>
                      </div>
                    )}

                    {addressTab === 'shipping' && (
                      <div className="space-y-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={form.sameAsBilling} onChange={e => handleSameAsBilling(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-gray-700">Same as Billing Address</span>
                        </label>
                        {!form.sameAsBilling && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                              <textarea value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })}
                                className="input-field" rows={2} />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                              <input value={form.shipping_address_line2} onChange={e => setForm({ ...form, shipping_address_line2: e.target.value })}
                                className="input-field" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                              <input value={form.shipping_city} onChange={e => setForm({ ...form, shipping_city: e.target.value })}
                                className="input-field" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                              <StateSelect value={form.shipping_state} onChange={v => setForm({ ...form, shipping_state: v })} />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                              <input value={form.shipping_country} onChange={e => setForm({ ...form, shipping_country: e.target.value })}
                                className="input-field" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                              <input value={form.shipping_postal_code} onChange={e => setForm({ ...form, shipping_postal_code: e.target.value })}
                                className="input-field" />
                            </div>
                          </div>
                        )}
                        {form.sameAsBilling && (
                          <p className="text-sm text-gray-400 italic">Shipping address will use the same details as billing address.</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                )}
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

      {selectedRecord && (isMobile ? (
          <BottomSheet
            open={!!selectedRecord}
            onClose={() => setSelectedRecord(null)}
            title={selectedRecord?.name || 'Supplier Details'}
            actions={
              <>
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); openEdit(r); }}
                  className="flex-1 btn-primary justify-center">Edit</button>
                {selectedRecord?.status === 'active' ? (
                  <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDeactivate(r.id, r.name); }}
                    className="flex-1 btn-warning justify-center">Deactivate</button>
                ) : (
                  <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleActivate(r.id); }}
                    className="flex-1 btn-success justify-center">Activate</button>
                )}
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDelete(r.id, r.name); }}
                  className="flex-1 btn-danger justify-center">Delete</button>
              </>
            }>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3 mb-3">
              <button type="button" onClick={() => setDetailTab('details')}
                className={`text-sm font-medium pb-1 ${detailTab === 'details' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}>Details</button>
              <button type="button" onClick={() => setDetailTab('transactions')}
                className={`text-sm font-medium pb-1 ${detailTab === 'transactions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}>Transactions</button>
            </div>
            {detailTab === 'details' ? <SupplierDetailContent supplier={selectedRecord} /> : <TransactionsTab partyType="supplier" partyId={selectedRecord.id} partyName={selectedRecord.name} />}
          </BottomSheet>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 animate-scale-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedRecord.name || 'Supplier Details'}</h3>
                <p className="text-sm text-gray-500 mt-0.5">Supplier Details</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <div className="flex items-center gap-3 px-6 pt-4 border-b border-gray-100 shrink-0">
              <button type="button" onClick={() => setDetailTab('details')}
                className={`text-sm font-medium pb-3 ${detailTab === 'details' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Details</button>
              <button type="button" onClick={() => setDetailTab('transactions')}
                className={`text-sm font-medium pb-3 ${detailTab === 'transactions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Transactions</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {detailTab === 'details' ? <SupplierDetailContent supplier={selectedRecord} /> : <TransactionsTab partyType="supplier" partyId={selectedRecord.id} partyName={selectedRecord.name} />}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end shrink-0">
              <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); openEdit(r); }}
                className="btn-primary text-sm">Edit</button>
              {selectedRecord?.status === 'active' ? (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDeactivate(r.id, r.name); }}
                  className="btn-warning text-sm">Deactivate</button>
              ) : (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleActivate(r.id); }}
                  className="btn-success text-sm">Activate</button>
              )}
              <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDelete(r.id, r.name); }}
                className="btn-danger text-sm">Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function SupplierDetailContent({ supplier }) {
  const balType = supplier.opening_balance_type === 'payable' ? 'Payable' : 'Receivable';
  return (
    <div className="space-y-3">
      <DetailRow label="Name" value={supplier.name} />
      <DetailRow label="Phone" value={formatPhone(supplier.phone)} />
      <DetailRow label="Email" value={supplier.email} />
      <DetailRow label="GSTIN" value={supplier.gstin} />
      <DetailRow label="PAN" value={supplier.pan} />

      <DetailRow label="Opening Balance" value={supplier.opening_balance ? `${formatINR(supplier.opening_balance)} (${balType})` : '—'} />
      <DetailRow label="Credit Period" value={supplier.credit_period ? `${supplier.credit_period} days` : '—'} />
      <DetailRow label="Credit Limit" value={supplier.credit_limit ? formatINR(supplier.credit_limit) : '—'} />
      <DetailRow label="Billing Address">
        <div>{supplier.billing_address}{supplier.billing_address_line2 ? `, ${supplier.billing_address_line2}` : ''}{supplier.billing_city || supplier.billing_address || supplier.billing_postal_code ? <><br/>{[supplier.billing_city, supplier.billing_state, supplier.billing_postal_code].filter(Boolean).join(', ')}{supplier.billing_country ? <><br/>{supplier.billing_country}</> : ''}</> : '—'}</div>
      </DetailRow>
      <DetailRow label="Shipping Address">
        <div>{supplier.shipping_address}{supplier.shipping_address_line2 ? `, ${supplier.shipping_address_line2}` : ''}{supplier.shipping_city || supplier.shipping_address || supplier.shipping_postal_code ? <><br/>{[supplier.shipping_city, supplier.shipping_state, supplier.shipping_postal_code].filter(Boolean).join(', ')}{supplier.shipping_country ? <><br/>{supplier.shipping_country}</> : ''}</> : '—'}</div>
      </DetailRow>
      <DetailRow label="Status">
        <span className={supplier.status === 'active' ? 'badge-success' : 'badge-danger'}>{supplier.status}</span>
      </DetailRow>
      <DetailRow label="Notes" value={supplier.notes} />
    </div>
  );
}

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default Suppliers;
