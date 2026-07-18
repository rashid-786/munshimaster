import { useMemo } from 'react';
import InvoiceTemplateView from './InvoiceTemplateView';
import { STATUS_STYLES } from '../config/documentConfig';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function logoFullUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = VITE_API_BASE_URL;
  const clean = url.replace(/^\/api\/v1/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
}

function fmtCurrency(paise) {
  const s = localStorage.getItem('currency_symbol') || '₹';
  return s + Number(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TransactionDetailView({ transaction, templateConfig, direction }) {
  const t = transaction || {};
  const items = t.items || [];
  const s = templateConfig || {};
  const cl = s.customLabels || {};
  const lbl = (k, fb) => cl[k] || fb;
  const tenant = t.tenant || {};
  const isSales = direction === 'sales';

  const infoLines = useMemo(() => {
    const lines = [];
    if (s.showInvoiceNo !== false) lines.push({ label: lbl('invoiceNumber', 'Document No'), value: t.document_number || '—' });
    if (s.showInvoiceDate !== false) lines.push({ label: lbl('invoiceDate', 'Date'), value: t.document_date ? new Date(t.document_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' });
    if (s.showDueDate !== false && t.due_date) lines.push({ label: lbl('dueDate', 'Due Date'), value: new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) });
    if (t.reference_number) lines.push({ label: lbl('referenceNumber', 'Reference'), value: t.reference_number });
    if (s.showPaymentTerms !== false && t.payment_terms) lines.push({ label: lbl('paymentTerms', 'Payment Terms'), value: t.payment_terms });
    return lines;
  }, [t, s, lbl]);

  const visibleCols = (s.itemColumns || []).filter(c => c.visible);
  const hasCustomCols = visibleCols.length > 0;
  const gstRates = new Set(items.map(i => i.gst_rate || 0).filter(r => r > 0));
  const gstLabel = gstRates.size === 1 ? `GST @ ${[...gstRates][0]}%` : 'GST';

  if (!t.document_number) return <div className="text-center py-8 text-gray-400 text-sm">No transaction data.</div>;

  const partyLabel = isSales ? 'Customer' : 'Supplier';

  return (
    <InvoiceTemplateView templateConfig={templateConfig}>
      <div className="space-y-5">
        {/* ── Party & Document Info ── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="text-sm text-gray-900 space-y-0.5">
            <p className="font-semibold" style={{ color: 'var(--template-primary)' }}>{lbl('billTo', partyLabel)}</p>
            <p className="font-medium">{t.party_name || '—'}</p>
            {t.party_gstin && <p className="text-gray-500">GSTIN: {t.party_gstin}</p>}
            {t.party_pan && <p className="text-gray-500">PAN: {t.party_pan}</p>}
            {t.party_address && <p className="text-gray-500">{t.party_address}</p>}
            {t.party_city && <p className="text-gray-500">{t.party_city}{t.party_state ? `, ${t.party_state}` : ''}</p>}
            {t.party_country && <p className="text-gray-500">{t.party_country}</p>}
          </div>
          <div className="text-sm space-y-0.5">
            {infoLines.map((il, i) => (
              <div key={i} className="flex gap-2">
                <span className="font-medium text-gray-600 shrink-0">{il.label}:</span>
                <span className="text-gray-900">{il.value}</span>
              </div>
            ))}
          </div>
        </div>

        {t.billing_address && t.billing_address !== t.party_address && (
          <div className="text-sm text-gray-900 space-y-0.5">
            <p className="font-semibold" style={{ color: 'var(--template-primary)' }}>Billing Address</p>
            <p className="text-gray-500">{t.billing_address}</p>
            {t.billing_city && <p className="text-gray-500">{t.billing_city}{t.billing_state ? `, ${t.billing_state}` : ''}</p>}
          </div>
        )}

        {t.shipping_address && t.shipping_address !== t.billing_address && (
          <div className="text-sm text-gray-900 space-y-0.5">
            <p className="font-semibold" style={{ color: 'var(--template-primary)' }}>Shipping Address</p>
            <p className="text-gray-500">{t.shipping_address}</p>
            {t.shipping_city && <p className="text-gray-500">{t.shipping_city}{t.shipping_state ? `, ${t.shipping_state}` : ''}</p>}
          </div>
        )}

        <div className="text-sm flex items-center justify-between">
          <div className="flex gap-x-6 flex-wrap">
            {t.place_of_supply && (
              <div className="flex gap-2">
                <span className="font-medium text-gray-600">{lbl('placeOfSupply', 'Place of Supply')}:</span>
                <span className="text-gray-900">{t.place_of_supply}</span>
              </div>
            )}
          </div>
          {t.status && (
            <div className="flex gap-2 items-center shrink-0">
              <span className="font-medium text-gray-600">{lbl('status', 'Status')}:</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[t.status] || 'bg-gray-100 text-gray-600'}`}>
                {t.status}
              </span>
            </div>
          )}
        </div>

        {/* ── Line Items Table ── */}
        {items.length > 0 && (
          <div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ backgroundColor: s.primaryColor || 'var(--template-primary, #374151)', color: '#fff' }}>
                  <th className="py-1.5 px-2 text-center w-8">#</th>
                  {hasCustomCols ? visibleCols.map(col => (
                    <th key={col.key} className={`py-1.5 px-2 ${col.key === 'rate' || col.key === 'quantity' || col.key === 'total' || col.key === 'discount' || col.key === 'gst' ? 'text-right' : 'text-left'}`}>
                      {lbl(col.key, col.label)}
                    </th>
                  )) : (
                    <>
                      <th className="py-1.5 px-2 text-left">Item</th>
                      <th className="py-1.5 px-2 text-right">Qty</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">Disc%</th>
                      <th className="py-1.5 px-2 text-right">GST%</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, i) => (
                  <tr key={item.id || i} className={i % 2 === 0 ? 'bg-gray-50/50' : ''}>
                    <td className="py-1.5 px-2 text-center text-gray-400">{i + 1}</td>
                    {hasCustomCols ? visibleCols.map(col => (
                      <td key={col.key} className={`py-1.5 px-2 ${col.key === 'rate' || col.key === 'quantity' || col.key === 'total' || col.key === 'discount' || col.key === 'gst' ? 'text-right' : 'text-left'} text-gray-900`}>
                        {col.key === 'description' && (item.description || item.item_name || '—')}
                        {col.key === 'hsn' && (item.hsn_sac || '—')}
                        {col.key === 'quantity' && item.quantity}
                        {col.key === 'unit' && (item.unit || '—')}
                        {col.key === 'rate' && fmtCurrency(item.rate || 0)}
                        {col.key === 'discount' && (item.discount_percent ? `${item.discount_percent}%` : '—')}
                        {col.key === 'gst' && `${item.gst_rate || 0}%`}
                        {col.key === 'total' && fmtCurrency(item.total_amount || 0)}
                        {col.key === 'sku' && (item._sku || '—')}
                        {col.key === 'itemCode' && (item.product_id || '—')}
                      </td>
                    )) : (
                      <>
                        <td className="py-1.5 px-2 text-gray-900">{item.description || item.item_name || '—'}</td>
                        <td className="py-1.5 px-2 text-right text-gray-900">{item.quantity}</td>
                        <td className="py-1.5 px-2 text-right text-gray-900">{fmtCurrency(item.rate || 0)}</td>
                        <td className="py-1.5 px-2 text-right text-gray-600">{item.discount_percent ? `${item.discount_percent}%` : '—'}</td>
                        <td className="py-1.5 px-2 text-right text-gray-600">{item.gst_rate || 0}%</td>
                        <td className="py-1.5 px-2 text-right font-medium text-gray-900">{fmtCurrency(item.total_amount || 0)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Financial Summary ── */}
        <div className="flex flex-col items-end text-sm space-y-1">
          <div className="flex justify-between w-64">
            <span className="text-gray-600">{lbl('subtotal', 'Subtotal')}:</span>
            <span className="text-gray-900">{fmtCurrency(t.subtotal || 0)}</span>
          </div>
          {t.discount_amount > 0 && (s.showDiscountTotal !== false) && (
            <div className="flex justify-between w-64">
              <span className="text-gray-600">{lbl('discountTotal', 'Discount')}:</span>
              <span className="text-red-600">-{fmtCurrency(t.discount_amount)}</span>
            </div>
          )}

          {(Number(t.cgst_amount) > 0 || Number(t.sgst_amount) > 0 || Number(t.igst_amount) > 0) && (
            <div className="flex justify-between w-64">
              <span className="text-gray-600">{gstLabel}:</span>
              <span className="text-gray-900">{fmtCurrency((Number(t.cgst_amount) || 0) + (Number(t.sgst_amount) || 0) + (Number(t.igst_amount) || 0))}</span>
            </div>
          )}
          {t.round_off !== 0 && s.showRoundOff !== false && (
            <div className="flex justify-between w-64">
              <span className="text-gray-600">{lbl('roundOff', 'Round Off')}:</span>
              <span className="text-gray-900">{fmtCurrency(t.round_off)}</span>
            </div>
          )}
          <div className="flex justify-between w-64 pt-1 border-t border-gray-300 font-semibold text-base"
            style={{ color: 'var(--template-primary)' }}>
            <span>{lbl('grandTotal', 'Grand Total')}:</span>
            <span>{fmtCurrency(t.grand_total || 0)}</span>
          </div>
          

        </div>

        {/* ── Notes / Terms ── */}
        {(t.notes || t.terms_conditions) && s.showTerms !== false && (
          <div className="text-sm space-y-2">
            {t.notes && (
              <div>
                <p className="font-semibold text-gray-700">{lbl('notes', 'Notes')}:</p>
                <p className="text-gray-600 whitespace-pre-wrap">{t.notes}</p>
              </div>
            )}
            {t.terms_conditions && (
              <div>
                <p className="font-semibold text-gray-700">{lbl('terms', 'Terms & Conditions')}:</p>
                <p className="text-gray-600 whitespace-pre-wrap">{t.terms_conditions}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Signature ── */}
        {s.showSignature !== false && (
          <div className="flex flex-col items-end pt-4">
            {s.signatureUrl && (
              <img src={logoFullUrl(s.signatureUrl)} alt="Signature" className="max-w-[130px] max-h-[40px] mb-1 object-contain" />
            )}
            {s.signatoryName && (
              <p className="text-sm font-semibold text-gray-800 text-center">{s.signatoryName}</p>
            )}
            {s.signatoryDesignation && (
              <p className="text-xs text-gray-500 text-center mb-0.5">{s.signatoryDesignation}</p>
            )}
            <div className="w-40 border-t border-gray-400 mb-1" />
            <p className="text-xs text-gray-500 text-center w-40">
              {lbl('authorizedSignatory', 'Authorized Signatory')}
            </p>
          </div>
        )}
      </div>
    </InvoiceTemplateView>
  );
}
