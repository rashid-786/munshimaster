import { useState, useEffect } from 'react';
import { formatINR } from '../utils/currency';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';

export default function LineItemsTable({ items, onChange, gstType = 'intra', readOnly }) {
  const [gstRates, setGstRates] = useState([{ gst_percentage: 0 }]);
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
    onChange([...items, { item_name: '', hsn_sac: '', quantity: 1, unit: 'Nos', rate: 0, discount_percent: 0, gst_rate: 0 }]);
  };
  const removeRow = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(next);
  };
  const update = (i, field, value) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: value } : item);
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
    return acc;
  }, { subtotal: 0, disc: 0, taxable: 0, gst: 0, total: 0 });

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
              <th className="text-left py-2 pr-2 min-w-[160px]">Item</th>
              <th className="text-left py-2 px-2 w-20">HSN/SAC</th>
              <th className="text-right py-2 px-2 w-16">Qty</th>
              <th className="text-left py-2 px-2 w-16">Unit</th>
              <th className="text-right py-2 px-2 w-24">Rate (₹)</th>
              <th className="text-right py-2 px-2 w-16">Disc%</th>
              <th className="text-right py-2 px-2 w-20">GST%</th>
              <th className="text-right py-2 px-2 w-28">Amount</th>
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
                      : <input value={item.item_name} onChange={e => update(i, 'item_name', e.target.value)}
                        className="w-full border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" placeholder="Item name" />}
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
                    {readOnly ? <span className="text-gray-900 text-right block">{formatINR(item.rate)}</span>
                      : <input type="number" value={item.rate} onChange={e => update(i, 'rate', e.target.value)}
                        className="w-full text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" min="0" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-600 text-right block">{item.discount_percent || 0}%</span>
                      : <input type="number" value={item.discount_percent} onChange={e => update(i, 'discount_percent', e.target.value)}
                        className="w-full text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1" min="0" max="100" />}
                  </td>
                  <td className="py-1.5 px-2">
                    {readOnly ? <span className="text-gray-600 text-right block">{item.gst_rate || 0}%</span>
                      : <select value={item.gst_rate} onChange={e => update(i, 'gst_rate', e.target.value)}
                        className="w-full border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 outline-none bg-transparent text-sm py-1">
                        {gstRates.length > 0
                          ? gstRates.map(r => <option key={r.id || r.gst_percentage} value={r.gst_percentage}>{r.name || `${r.gst_percentage}%`}</option>)
                          : [0, 0.25, 3, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>}
                  </td>
                  <td className="py-1.5 px-2 text-right text-sm font-medium text-gray-900">{formatINR(Math.round(c.total))}</td>
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
        <Row label="Subtotal" value={formatINR(Math.round(totals.subtotal))} />
        {totals.disc > 0 && <Row label="Discount" value={`- ${formatINR(Math.round(totals.disc))}`} />}
        <Row label="Taxable Amt" value={formatINR(Math.round(totals.taxable))} />
        {gstType === 'intra' ? (
          <>
            <Row label="CGST (50%)" value={formatINR(Math.round(totals.gst / 2))} />
            <Row label="SGST (50%)" value={formatINR(Math.round(totals.gst / 2))} />
          </>
        ) : (
          <Row label="IGST" value={formatINR(Math.round(totals.gst))} />
        )}
        <Row label="Grand Total" value={formatINR(Math.round(totals.total))} bold />
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
