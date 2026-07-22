import { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { ActionEdit, ActionDelete } from '../../components/ActionIcons';
function formatRupees(v) {
  const symbol = '₹';
  return symbol + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';
import Loading from '../../components/Loading';
import SearchableSelect from '../../components/SearchableSelect';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';

const emptyForm = {
  name: '', sku: '', unit: 'pcs', category: '', description: '', image_url: '',
  opening_stock: '', opening_stock_as_of: '', low_stock_threshold: '10', reorder_level: '',
  stock_tracking_enabled: true, barcode: '',
  selling_price: '', sale_price_type: 'exclusive', discount_percent: '', purchase_price: '', purchase_price_type: 'exclusive',
  hsn_code: '', tax_rate: '18', gst_rate_id: '', product_status: 'active',
};

function Checkbox({ checked, onChange }) {
  return (
    <input type="checkbox" checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
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
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [showMovement, setShowMovement] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'in', quantity: '', notes: '' });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(null);
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState(0);
  const [units, setUnits] = useState([]);
  const [gstRates, setGstRates] = useState([]);
  const [showGstDetails, setShowGstDetails] = useState(false);
  const [parties, setParties] = useState({ customers: [], suppliers: [] });
  const [partyPrices, setPartyPrices] = useState([]);
  const [partyPriceForm, setPartyPriceForm] = useState({ party_type: 'customer', party_id: '', custom_price: '', discount_percent: '', effective_from: '', effective_to: '' });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrService.getProducts({ limit: 500 });
      setProducts(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products.');
    } finally { setLoading(false); }
  }, []);

  const fetchLowStockAlerts = useCallback(async () => {
    try { const res = await hrService.getLowStockAlerts(); setLowStockAlerts(res.data || []); } catch {}
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const [uRes, gRes] = await Promise.all([
        fetch(`${API_BASE}/public/units`).then(r => r.json()),
        fetch(`${API_BASE}/public/gst-tax`).then(r => r.json()),
      ]);
      if (Array.isArray(uRes)) setUnits(uRes);
      if (Array.isArray(gRes)) setGstRates(gRes);
    } catch {}
    try {
      const [custRes, suppRes] = await Promise.all([
        hrService.getCustomers({ limit: 500 }),
        hrService.getSuppliers({ limit: 500 }),
      ]);
      setParties({
        customers: custRes.data || custRes || [],
        suppliers: suppRes.data || suppRes || [],
      });
    } catch {}
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchLowStockAlerts(); }, [fetchLowStockAlerts]);
  useEffect(() => { fetchLookups(); }, [fetchLookups]);

  const computeEffectivePrice = (price, priceType, taxRate, discountPercent) => {
    const p = parseFloat(price || 0);
    const disc = parseFloat(discountPercent || 0);
    const rate = parseFloat(taxRate || 0);
    let effective = p;
    if (disc > 0) effective = p * (1 - disc / 100);
    if (priceType === 'inclusive' && rate > 0) effective = effective / (1 + rate / 100);
    return Math.round(effective * 100) / 100;
  };

  const getTaxAmount = (price, priceType, taxRate) => {
    const p = parseFloat(price || 0);
    const rate = parseFloat(taxRate || 0);
    if (priceType === 'inclusive') return Math.round(p * rate / (100 + rate) * 100) / 100;
    return Math.round(p * rate / 100 * 100) / 100;
  };

  const efSalePrice = computeEffectivePrice(form.selling_price, form.sale_price_type, form.tax_rate, form.discount_percent);
  const efPurchasePrice = computeEffectivePrice(form.purchase_price, form.purchase_price_type, form.tax_rate, 0);
  const saleTaxAmt = getTaxAmount(form.selling_price, form.sale_price_type, form.tax_rate);
  const purchaseTaxAmt = getTaxAmount(form.purchase_price, form.purchase_price_type, form.tax_rate);

  const categories = [...new Set(products.filter(p => p.category).map(p => p.category))].sort();
  const filteredProducts = products.filter(p => {
    if (keyword && !p.name.toLowerCase().includes(keyword.toLowerCase()) && !p.sku?.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setActiveTab(0);
    setShowGstDetails(false);
    setPartyPrices([]);
    setShowForm(true);
  };

  const openEdit = async (product) => {
    setEditing(product);
    let pp = [];
    try {
      const full = await hrService.getProduct(product.id);
      pp = full.party_prices || [];
      product = full;
    } catch {}
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      unit: product.unit || 'pcs',
      category: product.category || '',
      description: product.description || '',
      image_url: product.image_url || '',
      opening_stock: product.opening_stock ?? '',
      opening_stock_as_of: product.opening_stock_as_of ? product.opening_stock_as_of.split('T')[0] : '',
      low_stock_threshold: product.low_stock_threshold ?? '10',
      reorder_level: product.reorder_level ?? '',
      stock_tracking_enabled: product.stock_tracking_enabled !== false,
      barcode: product.barcode || '',
      selling_price: product.selling_price ?? '',
      sale_price_type: product.sale_price_type || 'exclusive',
      discount_percent: product.discount_percent ?? '',
      purchase_price: product.purchase_price ?? '',
      purchase_price_type: product.purchase_price_type || 'exclusive',
      hsn_code: product.hsn_code || '',
      tax_rate: product.tax_rate ?? '18',
      gst_rate_id: product.gst_rate_id || '',
      product_status: product.product_status || 'active',
    });
    setPartyPrices(pp);
    setShowGstDetails(!!product.gst_rate_id || parseFloat(product.tax_rate) > 0);
    setActiveTab(0);
    setShowForm(true);
  };

  const handleSave = async () => {
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
      variant: 'danger', title: 'Delete Product',
      message: 'Permanently delete this product and all its stock movements? This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try { await hrService.deleteProduct(id); setModal(null); fetchProducts(); }
        catch (err) { setError(err.response?.data?.error || 'Delete failed.'); setModal(null); }
        finally { setModalLoading(false); }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setModal({
      variant: 'danger', title: `Delete ${selectedIds.size} Product(s)`,
      message: `Permanently delete ${selectedIds.size} product(s)? This cannot be undone.`,
      confirmLabel: 'Delete All',
      onConfirm: async () => {
        setBulkLoading(true);
        try { await hrService.bulkDeleteProducts([...selectedIds]); setSelectedIds(new Set()); setModal(null); fetchProducts(); }
        catch (err) { setError(err.response?.data?.error || 'Bulk delete failed.'); setModal(null); }
        finally { setBulkLoading(false); }
      },
    });
  };

  const openMovements = async (product) => {
    setShowMovement(product);
    setMovementsLoading(true);
    try { const res = await hrService.getStockMovements({ product_id: product.id }); setMovements(res.data || []); }
    catch (err) { setError(err.response?.data?.error || 'Failed to load movements.'); }
    finally { setMovementsLoading(false); }
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
      await hrService.recordStockMovement({ product_id: showAdjustForm.id, type: adjustForm.type, quantity: Number(adjustForm.quantity), notes: adjustForm.notes || 'Manual adjustment', reference_type: 'manual' });
      setShowAdjustForm(null);
      fetchProducts();
      fetchLowStockAlerts();
    } catch (err) { setError(err.response?.data?.error || 'Failed to adjust stock.'); }
    finally { setAdjustSaving(false); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // ─── Party Price handlers ────────────────────────────
  const addPartyPrice = () => {
    if (!partyPriceForm.party_id || !partyPriceForm.custom_price) return;
    const disc = parseFloat(partyPriceForm.discount_percent || 0);
    const price = parseFloat(partyPriceForm.custom_price || 0);
    const effPrice = disc > 0 ? Math.round(price * (1 - disc / 100) * 100) / 100 : price;
    const pp = { ...partyPriceForm, custom_price: price, discount_percent: disc, effective_price: effPrice, _temp: true };
    setPartyPrices([...partyPrices, pp]);
    setPartyPriceForm({ party_type: 'customer', party_id: '', custom_price: '', discount_percent: '', effective_from: '', effective_to: '' });
  };

  const removePartyPrice = (idx) => {
    setPartyPrices(partyPrices.filter((_, i) => i !== idx));
  };

  const savePartyPrices = async (productId) => {
    for (const pp of partyPrices) {
      if (pp._temp) {
        await hrService.createProductPartyPrice(productId, pp);
      }
    }
  };

  // ─── Columns ─────────────────────────────────────────
  const columns = [
    {
      key: 'select', label: <Checkbox checked={products.length > 0 && selectedIds.size === products.length}
        onChange={() => { if (selectedIds.size === products.length) setSelectedIds(new Set()); else setSelectedIds(new Set(products.map(p => p.id))); }} />,
      render: (_, r) => <Checkbox checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />,
    },
    { key: 'name', label: 'Product', render: (v, r) => (
      <div><span className="font-medium text-indigo-600">{v}</span>{r.sku && <span className="text-xs text-gray-400 ml-2">SKU: {r.sku}</span>}</div>
    )},
    { key: 'current_stock', label: 'Stock', render: (v, r) => {
      if (v == null) return <span className="text-gray-400">—</span>;
      const threshold = r.low_stock_threshold;
      const isLow = threshold != null && threshold > 0 && r.stock_tracking_enabled && Number(v) <= Number(threshold);
      return <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{v} {r.unit || 'pcs'}{isLow ? <span className="block text-xs text-red-500 font-normal">Low stock!</span> : null}</span>;
    }},
    { key: 'effective_sale_price', label: 'Sale Price', render: (v, r) => v ? formatRupees(v) : (r.selling_price ? formatRupees(r.selling_price) : '—') },
    { key: 'effective_purchase_price', label: 'Cost Price', render: (v, r) => v ? formatRupees(v) : (r.purchase_price ? formatRupees(r.purchase_price) : '—') },
    { key: 'category', label: 'Category', render: (v) => v || '—' },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => (
      <div className="flex gap-1.5 justify-end">
        <ActionEdit onClick={(e) => { e.stopPropagation(); openEdit(r); }} />
        <button onClick={(e) => { e.stopPropagation(); openAdjust(r); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Adjust Stock">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); openMovements(r); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Stock History">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        <ActionDelete onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} />
      </div>
    )},
  ];

  if (loading) return <Loading text="Loading inventory..." />;

  const TABS = ['General', 'Pricing', 'Stock', 'Party Price'];

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
                <span className="font-medium">{item.name}</span> — {item.current_stock ?? 0} {item.unit || 'pcs'} remaining (threshold: {item.low_stock_threshold})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Inventory</h2>
        <button onClick={openCreate} className="btn-primary">+ New Product</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="Search by name or SKU..." className="input-field text-sm w-full sm:w-64" />
        <SearchableSelect
          options={categories.map(c => ({ value: c, label: c }))}
          value={categoryFilter}
          onChange={setCategoryFilter}
          placeholder="All Categories"
          className="w-full sm:w-56"
        />
        {(keyword || categoryFilter) && (
          <button onClick={() => { setKeyword(''); setCategoryFilter(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline self-center">Clear</button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-indigo-700 font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button onClick={handleBulkDelete} disabled={bulkLoading} className="btn-danger text-xs px-3 py-1.5">{bulkLoading ? 'Deleting...' : 'Delete Selected'}</button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
          </div>
        </div>
      )}

      <ResponsiveTable
        columns={columns}
        data={filteredProducts}
        keyField="id"
        searchable
        searchKeys={['name', 'sku', 'barcode', 'hsn_code', 'category']}
        onRowClick={(p) => { if (isMobile) setMobileDetail(p); }}
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

      {/* ─── TABBED FORM MODAL ─────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Product' : 'New Product'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 shrink-0">
              {TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* TAB 1: General Information */}
              {activeTab === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Notebook A4" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
                      <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field" placeholder="e.g. Stationery" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={2} placeholder="Optional description" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="input-field" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.product_status} onChange={e => setForm({ ...form, product_status: e.target.value })} className="input-field">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: Pricing */}
              {activeTab === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure *</label>
                      <SearchableSelect
                        options={units.map(u => ({ value: u.name, label: u.name }))}
                        value={form.unit}
                        onChange={v => setForm({ ...form, unit: v })}
                        placeholder="Search unit..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                      <input value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} className="input-field" placeholder="e.g. 4820" />
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">Sales Pricing</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (₹)</label>
                        <input type="number" step="0.01" min="0" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                        <select value={form.sale_price_type} onChange={e => setForm({ ...form, sale_price_type: e.target.value })} className="input-field">
                          <option value="exclusive">Tax Exclusive</option>
                          <option value="inclusive">Tax Inclusive</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                        <input type="number" step="0.01" min="0" max="100" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Effective Sale Price</label>
                        <div className="input-field bg-gray-50 flex items-center h-[38px] font-semibold text-gray-900">{formatRupees(efSalePrice)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium text-gray-900">Purchase Pricing</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (₹)</label>
                        <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                        <select value={form.purchase_price_type} onChange={e => setForm({ ...form, purchase_price_type: e.target.value })} className="input-field">
                          <option value="exclusive">Tax Exclusive</option>
                          <option value="inclusive">Tax Inclusive</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">Effective Purchase Price</label>
                      <div className="input-field bg-gray-50 flex items-center h-[38px] font-semibold text-gray-900">{formatRupees(efPurchasePrice)}</div>
                    </div>
                  </div>

                  {/* GST & Tax Details */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button type="button" onClick={() => setShowGstDetails(!showGstDetails)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <span>+ GST & Tax Details</span>
                      <svg className={`w-4 h-4 transition-transform ${showGstDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showGstDetails && (
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                            <input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} className="input-field" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate</label>
                            <SearchableSelect
                              options={gstRates.map(r => ({ value: r.id, label: r.name }))}
                              value={form.gst_rate_id}
                              onChange={v => {
                                const selected = gstRates.find(r => r.id === v);
                                setForm({ ...form, gst_rate_id: v, tax_rate: selected ? selected.gst_percentage : form.tax_rate });
                              }}
                              placeholder="Search GST..."
                            />
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                          <div className="flex justify-between"><span className="text-gray-500">Taxable Amount (Sale)</span><span className="font-medium">{formatRupees(parseFloat(form.selling_price || 0))}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Tax Amount (Sale)</span><span className="font-medium text-indigo-600">{formatRupees(saleTaxAmt)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Total (Sale)</span><span className="font-semibold">{formatRupees(parseFloat(form.selling_price || 0) + saleTaxAmt)}</span></div>
                          <hr className="my-1" />
                          <div className="flex justify-between"><span className="text-gray-500">Taxable Amount (Purchase)</span><span className="font-medium">{formatRupees(parseFloat(form.purchase_price || 0))}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Tax Amount (Purchase)</span><span className="font-medium text-indigo-600">{formatRupees(purchaseTaxAmt)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Total (Purchase)</span><span className="font-semibold">{formatRupees(parseFloat(form.purchase_price || 0) + purchaseTaxAmt)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Stock */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-sm font-medium text-gray-700">Stock Tracking</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={form.stock_tracking_enabled} onChange={e => setForm({ ...form, stock_tracking_enabled: e.target.checked })} className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                    </label>
                    <span className="text-xs text-gray-500">{form.stock_tracking_enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>

                  {form.stock_tracking_enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label>
                          <input type="number" min="0" step="0.01" value={form.opening_stock} onChange={e => setForm({ ...form, opening_stock: e.target.value })} className="input-field" disabled={!!editing} placeholder="0" />
                          {editing && <p className="text-xs text-amber-500 mt-1">Opening stock can only be set on creation.</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock As Of</label>
                          <input type="date" value={form.opening_stock_as_of} onChange={e => setForm({ ...form, opening_stock_as_of: e.target.value })} className="input-field" disabled={!!editing} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert Quantity</label>
                          <input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} className="input-field" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                          <input type="number" min="0" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: e.target.value })} className="input-field" placeholder="0" />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Identification</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Item Code</label>
                        <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="input-field" placeholder="Auto-generated if empty" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                        <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="input-field" placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Party Price */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Set customer/supplier-specific pricing for this product. Party-specific prices take priority during invoice creation.</p>

                  <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Party Type</label>
                        <select value={partyPriceForm.party_type} onChange={e => setPartyPriceForm({ ...partyPriceForm, party_type: e.target.value, party_id: '' })} className="input-field">
                          <option value="customer">Customer</option>
                          <option value="supplier">Supplier</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select {partyPriceForm.party_type === 'customer' ? 'Customer' : 'Supplier'}</label>
                        <select value={partyPriceForm.party_id} onChange={e => setPartyPriceForm({ ...partyPriceForm, party_id: e.target.value })} className="input-field">
                          <option value="">Select...</option>
                          {(partyPriceForm.party_type === 'customer' ? parties.customers : parties.suppliers).map(p => (
                            <option key={p.id} value={p.id}>{p.name || p.company_name || p.contact_person}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Custom Price (₹)</label>
                        <input type="number" step="0.01" min="0" value={partyPriceForm.custom_price} onChange={e => setPartyPriceForm({ ...partyPriceForm, custom_price: e.target.value })} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                        <input type="number" step="0.01" min="0" max="100" value={partyPriceForm.discount_percent} onChange={e => setPartyPriceForm({ ...partyPriceForm, discount_percent: e.target.value })} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-500 mb-1">Effective Price</label>
                        <div className="input-field bg-gray-50 flex items-center h-[38px] font-semibold text-gray-900">
                          {Number(computeEffectivePrice(partyPriceForm.custom_price, 'exclusive', 0, partyPriceForm.discount_percent)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                        <input type="date" value={partyPriceForm.effective_from} onChange={e => setPartyPriceForm({ ...partyPriceForm, effective_from: e.target.value })} className="input-field" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
                        <input type="date" value={partyPriceForm.effective_to} onChange={e => setPartyPriceForm({ ...partyPriceForm, effective_to: e.target.value })} className="input-field" />
                      </div>
                    </div>
                    <button type="button" onClick={addPartyPrice} disabled={!partyPriceForm.party_id || !partyPriceForm.custom_price}
                      className="btn-secondary text-sm px-4">+ Add Price</button>
                  </div>

                  {partyPrices.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
                            <th className="text-left py-2">Party</th>
                            <th className="text-right py-2">Price</th>
                            <th className="text-right py-2">Disc%</th>
                            <th className="text-right py-2">Effective</th>
                            <th className="text-left py-2 pl-8">From</th>
                            <th className="text-left py-2 pl-2">To</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {partyPrices.map((pp, i) => (
                            <tr key={i} className="border-b border-gray-50">
                              <td className="py-2 font-medium text-gray-900">
                                {(() => {
                                  const list = pp.party_type === 'supplier' ? parties.suppliers : parties.customers;
                                  const found = list.find(p => p.id === pp.party_id);
                                  return found ? (found.name || found.company_name || found.contact_person) : pp.party_id?.substring(0, 8);
                                })()}
                              </td>
                              <td className="py-2 text-right">{Number(pp.custom_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-2 text-right">{pp.discount_percent || 0}%</td>
                              <td className="py-2 text-right font-semibold">{Number(pp.effective_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-2 text-gray-500 pl-8">{pp.effective_from || '—'}</td>
                              <td className="py-2 text-gray-500 pl-2">{pp.effective_to || '—'}</td>
                              <td className="py-2">
                                <button onClick={() => removePartyPrice(i)} className="text-red-400 hover:text-red-600">&times;</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update Product' : 'Create Product'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {showAdjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Adjust Stock — {showAdjustForm.name}</h3>
              <button type="button" onClick={() => setShowAdjustForm(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAdjustSave} className="p-5 space-y-4">
              <div className="text-sm text-gray-500">Current stock: <span className="font-semibold text-gray-900">{showAdjustForm.current_stock ?? 0} {showAdjustForm.unit || 'pcs'}</span></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={adjustForm.type} onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })} className="input-field">
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input type="number" step="0.01" min="0.01" value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} className="input-field" placeholder="Enter quantity" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={adjustForm.notes} onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })} className="input-field" rows={2} placeholder="Reason for adjustment" />
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
          <div className="fixed inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Stock History — {showMovement.name}</h3>
              <button type="button" onClick={() => setShowMovement(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-5">
              {movementsLoading ? <Loading text="Loading movements..." /> : movements.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No stock movements recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-3 font-medium">Date</th>
                        <th className="pb-2 pr-3 font-medium">Type</th>
                        <th className="pb-2 pr-3 font-medium text-right">Qty</th>
                        <th className="pb-2 pr-3 font-medium">Reference</th>
                        <th className="pb-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b border-gray-50">
                          <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{m.created_at?.split('T')[0] || '—'}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              m.type === 'in' ? 'bg-green-50 text-green-700' : m.type === 'out' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {m.type === 'in' ? '▲' : m.type === 'out' ? '▼' : '◆'} {m.type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{m.quantity}</td>
                          <td className="py-2.5 pr-3">
                            {m.ref_doc_number ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-700 font-medium text-xs bg-gray-100 px-2 py-0.5 rounded">{m.ref_doc_number}</span>
                                {m.ref_doc_type && (
                                  <span className="text-gray-400 text-[10px] uppercase tracking-wide">{m.ref_doc_type.replace(/_/g, ' ')}</span>
                                )}
                              </div>
                            ) : m.reference_type === 'opening' ? (
                              <span className="text-gray-400 text-xs">Opening Balance</span>
                            ) : m.reference_type === 'manual' ? (
                              <span className="text-gray-400 text-xs">Manual</span>
                            ) : (
                              <span className="text-gray-400 text-xs">{m.reference_type || '—'}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-gray-500 max-w-[180px] truncate text-xs">{m.notes || '—'}</td>
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
              <div><span className="text-gray-500">SKU</span><p className="font-medium">{mobileDetail.sku || '—'}</p></div>
              <div><span className="text-gray-500">Stock</span><p className={`font-semibold ${mobileDetail.low_stock_threshold && Number(mobileDetail.current_stock) <= Number(mobileDetail.low_stock_threshold) ? 'text-red-600' : ''}`}>{mobileDetail.current_stock ?? 0} {mobileDetail.unit || 'pcs'}</p></div>
              <div><span className="text-gray-500">Sale Price</span><p className="font-medium">{mobileDetail.effective_sale_price ? formatRupees(mobileDetail.effective_sale_price) : mobileDetail.selling_price ? formatRupees(mobileDetail.selling_price) : '—'}</p></div>
              <div><span className="text-gray-500">Cost Price</span><p className="font-medium">{mobileDetail.effective_purchase_price ? formatRupees(mobileDetail.effective_purchase_price) : mobileDetail.purchase_price ? formatRupees(mobileDetail.purchase_price) : '—'}</p></div>
              <div><span className="text-gray-500">Category</span><p className="font-medium">{mobileDetail.category || '—'}</p></div>
              <div><span className="text-gray-500">HSN</span><p className="font-medium">{mobileDetail.hsn_code || '—'}</p></div>
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
}
