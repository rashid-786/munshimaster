import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { ActionEdit, ActionDelete } from '../../components/ActionIcons';
import { formatINR } from '../../utils/currency';
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';
import Loading from '../../components/Loading';

const emptyForm = {
  name: '', sku: '', unit: 'pcs', opening_stock: '', low_stock_threshold: '10',
  selling_price: '', purchase_price: '', hsn_code: '', tax_rate: '18',
};

const units = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack', 'dozen', 'bag'];

function Checkbox({ checked, onChange }) {
  return (
    <input type="checkbox" checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
  );
}

const Products = () => {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [showMovement, setShowMovement] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'in', quantity: '', notes: '' });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(null);
  const isMobile = useIsMobile();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const res = await hrService.getProducts(params);
      setProducts(res.products || res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products.');
    } finally { setLoading(false); }
  }, [search]);

  const fetchLowStockAlerts = useCallback(async () => {
    try {
      const res = await hrService.getLowStockAlerts();
      setLowStockAlerts(res.alerts || res.data || []);
    } catch (err) { /* ignore */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchLowStockAlerts(); }, [fetchLowStockAlerts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      unit: product.unit || 'pcs',
      opening_stock: product.opening_stock ?? '',
      low_stock_threshold: product.low_stock_threshold ?? '10',
      selling_price: product.selling_price ?? '',
      purchase_price: product.purchase_price ?? '',
      hsn_code: product.hsn_code || '',
      tax_rate: product.tax_rate ?? '18',
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Product name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await hrService.updateProduct(editing.id, form);
      } else {
        await hrService.createProduct(form);
      }
      setShowForm(false);
      setEditing(null);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save product.');
    } finally { setSaving(false); }
  };

  const handleDelete = (id) => {
    setModal({
      variant: 'danger',
      title: 'Delete Product',
      message: 'Permanently delete this product and all its stock movements? This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deleteProduct(id);
          setModal(null);
          fetchProducts();
        } catch (err) {
          setError(err.response?.data?.error || 'Delete failed.');
          setModal(null);
        } finally { setModalLoading(false); }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setModal({
      variant: 'danger',
      title: `Delete ${selectedIds.size} Product(s)`,
      message: `Permanently delete ${selectedIds.size} product(s)? This cannot be undone.`,
      confirmLabel: 'Delete All',
      onConfirm: async () => {
        setBulkLoading(true);
        try {
          await hrService.bulkDeleteProducts([...selectedIds]);
          setSelectedIds(new Set());
          setModal(null);
          fetchProducts();
        } catch (err) {
          setError(err.response?.data?.error || 'Bulk delete failed.');
          setModal(null);
        } finally { setBulkLoading(false); }
      },
    });
  };

  const openMovements = async (product) => {
    setShowMovement(product);
    setMovementsLoading(true);
    try {
      const res = await hrService.getStockMovements({ product_id: product.id });
      setMovements(res.movements || res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load movements.');
    } finally { setMovementsLoading(false); }
  };

  const openAdjust = (product) => {
    setShowAdjustForm(product);
    setAdjustForm({ type: 'in', quantity: '', notes: '' });
  };

  const handleAdjustSave = async (e) => {
    e.preventDefault();
    if (!adjustForm.quantity || Number(adjustForm.quantity) <= 0) { setError('Valid quantity required.'); return; }
    setAdjustSaving(true);
    setError('');
    try {
      await hrService.recordStockMovement({
        product_id: showAdjustForm.id,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        notes: adjustForm.notes || 'Manual adjustment',
        reference_type: 'manual',
      });
      setShowAdjustForm(null);
      fetchProducts();
      fetchLowStockAlerts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to adjust stock.');
    } finally { setAdjustSaving(false); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = React.useMemo(() => [
    {
      key: 'select', label: React.createElement(Checkbox, {
        checked: products.length > 0 && selectedIds.size === products.length,
        onChange: () => {
          if (selectedIds.size === products.length) setSelectedIds(new Set());
          else setSelectedIds(new Set(products.map(p => p.id)));
        },
      }),
      render: (_, r) => React.createElement(Checkbox, {
        checked: selectedIds.has(r.id),
        onChange: () => toggleSelect(r.id),
      }),
    },
    { key: 'name', label: 'Product', render: (v, r) => (
      <div><span className="font-medium text-indigo-600">{v}</span>{r.sku && <span className="text-xs text-gray-400 ml-2">SKU: {r.sku}</span>}</div>
    )},
    { key: 'current_stock', label: 'Stock', render: (v, r) => {
      const low = r.low_stock_threshold && Number(v) <= Number(r.low_stock_threshold);
      return (
        <span className={`font-semibold ${low ? 'text-red-600' : 'text-gray-900'}`}>
          {v ?? 0} {r.unit || 'pcs'}
          {low && <span className="block text-xs text-red-500 font-normal">Low stock!</span>}
        </span>
      );
    }},
    { key: 'selling_price', label: 'Sale Price', render: (v) => v ? formatINR(v) : '—' },
    { key: 'purchase_price', label: 'Cost Price', render: (v) => v ? formatINR(v) : '—' },
    { key: 'hsn_code', label: 'HSN', render: (v) => v || '—' },
    { key: 'actions', label: 'Actions', className: 'text-right', render: (_, r) => (
      <div className="flex gap-1.5 justify-end">
        <ActionEdit onClick={(e) => { e.stopPropagation(); openEdit(r); }} />
        <button onClick={(e) => { e.stopPropagation(); openAdjust(r); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Adjust">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); openMovements(r); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="History">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        <ActionDelete onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} />
      </div>
    )},
  ], [products, selectedIds]);

  const movementColumns = React.useMemo(() => [
    { key: 'created_at', label: 'Date', render: (v) => v?.split('T')[0] || '—' },
    { key: 'type', label: 'Type', render: (v) => (
      <span className={`${v === 'in' ? 'text-green-600' : v === 'out' ? 'text-red-600' : 'text-amber-600'} font-medium`}>{v}</span>
    )},
    { key: 'quantity', label: 'Qty', render: (v) => v },
    { key: 'reference_type', label: 'Reference', render: (v) => v || '—' },
    { key: 'notes', label: 'Notes', render: (v) => v || '—' },
  ], []);

  if (loading) return <Loading text="Loading inventory..." />;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {lowStockAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <h3 className="font-semibold text-amber-800">Low Stock Alerts</h3>
          </div>
          <div className="space-y-1">
            {lowStockAlerts.map((item) => (
              <div key={item.id} className="text-sm text-amber-700">
                <span className="font-medium">{item.name}</span> — {item.current_stock ?? 0} {item.unit || 'pcs'} remaining
                (threshold: {item.low_stock_threshold})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Inventory</h2>
        <button onClick={openCreate} className="btn-primary">+ New Product</button>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-indigo-700 font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button onClick={handleBulkDelete} disabled={bulkLoading}
              className="btn-danger text-xs px-3 py-1.5">{bulkLoading ? 'Deleting...' : 'Delete Selected'}</button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
          </div>
        </div>
      )}

      <ResponsiveTable
        columns={columns}
        data={products}
        keyField="id"
       
        searchKeys={['name', 'sku', 'hsn_code']}
        onRowClick={(p) => {
          if (isMobile) setMobileDetail(p);
        }}
      />

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

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{editing ? 'Edit Product' : 'New Product'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="input-field" placeholder="e.g. Notebook A4" required />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                    className="input-field" placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                    className="input-field">
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label>
                  <input type="number" min="0" value={form.opening_stock} onChange={e => setForm({ ...form, opening_stock: e.target.value })}
                    className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                  <input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })}
                    className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (₹)</label>
                  <input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })}
                    className="input-field" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                  <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                    className="input-field" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                  <input type="text" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                    className="input-field" placeholder="e.g. 4820" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })}
                    className="input-field" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {showAdjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowAdjustForm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Adjust Stock — {showAdjustForm.name}</h3>
              <button type="button" onClick={() => setShowAdjustForm(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAdjustSave} className="p-5 space-y-4">
              <div className="text-sm text-gray-500">
                Current stock: <span className="font-semibold text-gray-900">{showAdjustForm.current_stock ?? 0} {showAdjustForm.unit || 'pcs'}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={adjustForm.type} onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="input-field">
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input type="number" step="0.01" min="0.01" value={adjustForm.quantity}
                  onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  className="input-field" placeholder="Enter quantity" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={adjustForm.notes} onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="input-field" rows={2} placeholder="Reason for adjustment" />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowAdjustForm(null)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={adjustSaving} className="btn-primary">{adjustSaving ? 'Adjusting...' : 'Adjust Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement History Modal */}
      {showMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowMovement(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Stock History — {showMovement.name}</h3>
              <button type="button" onClick={() => setShowMovement(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-5">
              {movementsLoading ? (
                <Loading text="Loading movements..." />
              ) : movements.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No stock movements recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Qty</th>
                        <th className="pb-2 font-medium">Reference</th>
                        <th className="pb-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-500">{m.created_at?.split('T')[0] || '—'}</td>
                          <td className="py-2">
                            <span className={`${m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-600' : 'text-amber-600'} font-medium`}>{m.type}</span>
                          </td>
                          <td className="py-2 font-medium">{m.quantity}</td>
                          <td className="py-2 text-gray-500">{m.reference_type || '—'}{m.reference_id ? ` #${m.reference_id}` : ''}</td>
                          <td className="py-2 text-gray-500 max-w-[200px] truncate">{m.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Detail Bottom Sheet */}
      {isMobile && mobileDetail && (
        <BottomSheet open={!!mobileDetail} onClose={() => setMobileDetail(null)}>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">{mobileDetail.name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">SKU</span>
                <p className="font-medium">{mobileDetail.sku || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Current Stock</span>
                <p className={`font-semibold ${mobileDetail.low_stock_threshold && Number(mobileDetail.current_stock) <= Number(mobileDetail.low_stock_threshold) ? 'text-red-600' : ''}`}>
                  {mobileDetail.current_stock ?? 0} {mobileDetail.unit || 'pcs'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Sale Price</span>
                <p className="font-medium">{mobileDetail.selling_price ? formatINR(mobileDetail.selling_price) : '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Purchase Price</span>
                <p className="font-medium">{mobileDetail.purchase_price ? formatINR(mobileDetail.purchase_price) : '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">HSN</span>
                <p className="font-medium">{mobileDetail.hsn_code || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Tax Rate</span>
                <p className="font-medium">{mobileDetail.tax_rate ? `${mobileDetail.tax_rate}%` : '—'}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setMobileDetail(null); openEdit(mobileDetail); }} className="btn-secondary flex-1 text-sm">Edit</button>
              <button onClick={() => { setMobileDetail(null); openAdjust(mobileDetail); }} className="btn-secondary flex-1 text-sm">Adjust</button>
              <button onClick={() => { setMobileDetail(null); openMovements(mobileDetail); }} className="btn-secondary flex-1 text-sm">History</button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default Products;
