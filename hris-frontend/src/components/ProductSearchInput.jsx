import { useState, useRef, useEffect, useCallback } from 'react';
import { hrService } from '../services/hr.service';

export default function ProductSearchInput({ value, onSelect, direction = 'sales' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef(null);
  const inputRef = useRef(null);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = q ? { search: q, limit: 20, status: 'active' } : { limit: 25, status: 'active' };
      const res = await hrService.getProducts(params);
      setProducts(res.data || []);
    } catch { setProducts([]); }
    setLoading(false);
  }, []);

  let debounce = useRef(null);
  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    setHighlight(0);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 200);
    setOpen(true);
    positionDropdown();
  };

  const positionDropdown = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 380),
        zIndex: 99999,
      });
    }
  };

  const fetchAll = useCallback(() => {
    search('');
    setOpen(true);
    positionDropdown();
  }, [search]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.product-dropdown-fixed')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectProduct = (product) => {
    setQuery(product.name);
    setOpen(false);
    onSelect(product);
  };

  const handleKey = (e) => {
    if (!open || products.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, products.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && products[highlight]) { e.preventDefault(); selectProduct(products[highlight]); }
    if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={ref} className="relative w-full">
      <input ref={inputRef} value={query} onChange={handleInput} onFocus={fetchAll} onClick={fetchAll} onKeyDown={handleKey}
        className="w-full border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1"
        placeholder="Search or select product..." autoComplete="off" />
      {loading && <div className="absolute right-1 top-1/2 -translate-y-1/2"><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>}
      {open && products.length > 0 && (
        <div className="product-dropdown-fixed" style={dropdownStyle}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
            {products.map((p, i) => (
              <div key={p.id} className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-3 transition-colors ${i === highlight ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                onMouseEnter={() => setHighlight(i)} onClick={() => selectProduct(p)}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                    {p.sku && <span>SKU: {p.sku}</span>}
                    {p.hsn_code && <span>HSN: {p.hsn_code}</span>}
                    {p.description && <span className="truncate max-w-[120px]">{p.description}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-gray-700">₹{Number(direction === 'sales' ? (p.effective_sale_price ?? p.selling_price ?? 0) : (p.effective_purchase_price ?? p.purchase_price ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className={`text-xs ${(p.current_stock || 0) <= 0 ? 'text-red-500' : (p.current_stock || 0) <= (p.low_stock_threshold || 0) ? 'text-amber-500' : 'text-green-600'}`}>
                    Stock: {p.current_stock || 0} {p.unit || 'pcs'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {open && !loading && products.length === 0 && query.length === 0 && (
        <div className="product-dropdown-fixed" style={dropdownStyle}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl p-4 text-sm text-gray-400 text-center">No products found. Add products in Settings → Products first.</div>
        </div>
      )}
      {open && !loading && products.length === 0 && query.length > 0 && (
        <div className="product-dropdown-fixed" style={dropdownStyle}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl p-4 text-sm text-gray-400 text-center">No products matching "{query}"</div>
        </div>
      )}
    </div>
  );
}
