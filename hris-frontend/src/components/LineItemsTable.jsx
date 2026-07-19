import { useState, useEffect } from 'react';
import ProductSearchInput from './ProductSearchInput';

function fmt(val) {
  const s = localStorage.getItem('currency_symbol') || '₹';
  return s + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';

export default function LineItemsTable({ items, onChange, gstType = 'intra', readOnly, direction = 'sales' }) {
  const [gstRates, setGstRates] = useState([]);
  const [gstLoading, setGstLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/gst-tax`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setGstRates(data
            .filter(r => r.is_active !== false)
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          );
        }
      } catch {}
      setGstLoading(false);
    })();
  }, []);
  const addRow = () => {
    onChange([...items, { item_name: '', hsn_sac: '', quantity: 1, unit: 'Nos', rate: 0, discount_percent: 0, gst_rate: 0, product_id: null, _sku: '', _description: '' }]);
  };
  const removeRow = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next);
  };
  const update = (i, field, value) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: value } : item);
    onChange(next);
  };
  const onProductSelect = (i, product) => {
    const price = direction === 'sales'
      ? (product.effective_sale_price || product.selling_price || 0)
      : (product.effective_purchase_price || product.purchase_price || 0);
    const next = items.map((item, idx) =>
      idx === i
        ? {
            ...item,
            product_id: product.id,
            item_name: product.name,
            hsn_sac: product.hsn_code || '',
            unit: product.unit || 'Nos',
            rate: price,
            gst_rate: parseFloat(product.tax_rate) || 0,
            _stock: product.current_stock || 0,
            _lowStock: product.low_stock_threshold || 0,
            _sku: product.sku || '',
            _description: product.description || '',
          }
        : item
    );
    onChange(next);
  };

  const calc = (item) => {
    const rate = parseFloat(item.rate || 0);
    const qty = parseFloat(item.quantity || 1);
    const disc = parseFloat(item.discount_percent || 0);
    const gst = parseFloat(item.gst_rate || 0);
    const lineTotal = rate * qty;
    const discAmt = Math.round(lineTotal * disc / 100);
    const taxable = lineTotal - discAmt;
    const gstAmt = gstType === 'intra' ? Math.round(taxable * gst / 100 / 2) * 2 : Math.round(taxable * gst / 100);
    return { lineTotal, discAmt, taxable, gstAmt, total: taxable + gstAmt };
  };

  const totals = items.reduce((acc, item) => {
    const c = calc(item);
    acc.subtotal += c.lineTotal;
    acc.disc += c.discAmt;
    acc.taxable += c.taxable;
    acc.gst += c.gstAmt;
    acc.total += c.total;
    acc._rates.add(item.gst_rate || 0);
    return acc;
  }, { subtotal: 0, disc: 0, taxable: 0, gst: 0, total: 0, _rates: new Set() });

  const gstLabel = totals._rates.size === 1 && totals.gst > 0
    ? `GST @ ${[...totals._rates][0]}%`
    : 'GST';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
              <th className="text-left py-2 pr-2 min-w-[200px]">Item</th>
              <th className="text-left py-2 px-2 w-20">HSN/SAC</th>
              <th className="text-right py-2 px-2 w-16">Qty</th>
              <th className="text-left py-2 px-2 w-16">Unit</th>
              <th className="text-right py-2 px-2 w-24">Rate (₹)</th>
              <th className="text-right py-2 px-2 w-16">Disc%</th>
              <th className="text-right py-2 px-2 w-28">GST%</th>
              <th className="text-right py-2 px-2 w-28">Amount</th>
              <th className="w-10" />
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const c = calc(item);
              return (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 pr-2">
                    {readOnly ? <span className="text-gray-900">{item.item_name}</span>
                      : <ProductSearchInput value={item.item_name} direction={direction}
                          onSelect={(product) => onProductSelect(i, product)} />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-600">{item.hsn_sac || '—'}</span>
                      : <input value={item.hsn_sac} onChange={e => update(i, 'hsn_sac', e.target.value)}
                        className="w-full border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-900 text-right block">{item.quantity}</span>
                      : <input type="number" value={item.quantity} onChange={e => update(i, 'quantity', e.target.value)}
                        className="w-full text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" min="0" step="0.01" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-600">{item.unit || 'Nos'}</span>
                      : <input value={item.unit || 'Nos'} onChange={e => update(i, 'unit', e.target.value)}
                        className="w-full border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-900 text-right block">{fmt(item.rate)}</span>
                      : <input type="number" value={item.rate} onChange={e => update(i, 'rate', e.target.value)}
                        className="w-full text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" min="0" step="any" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-600 text-right block">{item.discount_percent || 0}%</span>
                      : <input type="number" value={item.discount_percent} onChange={e => update(i, 'discount_percent', e.target.value)}
                        className="w-full text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" min="0" max="100" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-600 text-right block">{item.gst_rate || 0}%</span>
                      : <select value={Number(item.gst_rate)} onChange={e => update(i, 'gst_rate', parseFloat(e.target.value))}
                        className="w-full border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1">
                        {gstRates.length > 0
                          ? gstRates.map(r => <option key={r.id || r.gst_percentage} value={Number(r.gst_percentage)}>{r.name || `${r.gst_percentage}%`}</option>)
                          : [0, 0.25, 3, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>}
                  </td>
                  <td className="py-1.5 px-2 text-right text-sm font-medium text-gray-900">{fmt(Math.round(c.total))}</td>
                  <td className="py-1.5 px-1">
                    {!readOnly && item.product_id && (
                      <span title="Stock status" className={`inline-block w-2 h-2 rounded-full ${(item._stock || 0) <= 0 ? 'bg-red-500' : (item._stock || 0) <= (item._lowStock || 0) ? 'bg-amber-400' : 'bg-green-500'}`} />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="py-1.5 pl-1">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeRow(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button type="button" onClick={addRow} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">+ Add Item</button>
      )}

      <div className="border-t border-gray-200 pt-2 space-y-1 text-sm ml-auto w-full max-w-xs">
        <Row label="Subtotal" value={fmt(Math.round(totals.subtotal))} />
        {totals.disc > 0 && <Row label="Discount" value={`- ${fmt(Math.round(totals.disc))}`} />}
        <Row label="Taxable Amt" value={fmt(Math.round(totals.taxable))} />
        <Row label={gstLabel} value={fmt(Math.round(totals.gst))} />
        <Row label="Grand Total" value={fmt(Math.round(totals.total))} bold />
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between">
      <span className={`text-gray-500 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-gray-900 ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}
