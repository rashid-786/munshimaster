import { useState, useEffect } from 'react';
import { hrService } from '../services/hr.service';
import SearchableSelect from './SearchableSelect';

export default function AdjustStockModal({ open, productId, onClose, onAdjusted }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedId, setSelectedId] = useState(productId || '');
  const [type, setType] = useState('in');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(productId || '');
    setType('in');
    setQuantity('');
    setNotes('');
    setError('');
    setDone(null);
    setLoadingProducts(true);
    hrService.getProducts({ limit: 500 })
      .then(res => setProducts(res?.data || res || []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [open, productId]);

  if (!open) return null;

  const options = products.map(p => ({
    value: p.id,
    label: `${p.name}${p.sku ? ' (' + p.sku + ')' : ''} — stock: ${p.current_stock ?? 0} ${p.unit || ''}`,
  }));

  const handleSave = async () => {
    if (!selectedId) { setError('Select a product.'); return; }
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { setError('Enter a valid quantity.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await hrService.recordStockMovement({ product_id: selectedId, type, quantity: qty, notes });
      setDone({ currentStock: res.currentStock });
      if (onAdjusted) onAdjusted();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to adjust stock.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Adjust Stock</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {done ? (
            <div className="text-center py-4">
              <p className="text-emerald-600 font-medium">Stock updated</p>
              <p className="text-sm text-gray-500 mt-1">New stock: {done.currentStock}</p>
              <button onClick={onClose} className="btn-primary mt-4">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
                <SearchableSelect
                  options={options}
                  value={selectedId}
                  onChange={setSelectedId}
                  placeholder={loadingProducts ? 'Loading…' : 'Select product'}
                  disabled={loadingProducts}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Adjustment</label>
                <div className="inline-flex bg-gray-100 rounded-lg p-1 w-full">
                  {[['in', 'Stock In'], ['out', 'Stock Out'], ['adjustment', 'Set / Adjust']].map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setType(v)}
                      className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${type === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason / Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder="e.g. damaged, physical count" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
