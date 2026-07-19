import { useState, useEffect, useMemo, useCallback } from 'react';
import { hrService } from '../services/hr.service';
import { DIRECTION, DOCUMENT_CONFIG, DOC_LABELS, DOC_PREFIXES, STATUS_OPTIONS } from '../config/documentConfig';
import LineItemsTable from './LineItemsTable';
import SearchableSelect from './SearchableSelect';
import { getStates } from '../services/auth.service';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toISOString().split('T')[0];
}

export default function TransactionForm({ transactionType, initial, onClose, onSaved }) {
  const cfg = DOCUMENT_CONFIG[transactionType];
  const isSalesInvoice = transactionType === 'sales_invoice';
  const hasLineItems = cfg?.fields?.lineItems || cfg?.fields?.reason;
  const TAB_KEYS = ['document', ...(hasLineItems ? ['items'] : []), 'payment'];
  const TAB_LABELS = { document: 'Invoice Info', items: 'Line Items', payment: 'Payment & Notes' };
  const today = new Date().toISOString().split('T')[0];

  const initForm = useMemo(() => ({
    document_number: '',
    status: 'draft',
    ...initial,
    document_date: toDateInput(initial?.document_date) || today,
    due_date: toDateInput(initial?.due_date) || addDays(today, 30),
    valid_until: toDateInput(initial?.valid_until),
    expected_delivery_date: toDateInput(initial?.expected_delivery_date),
  }), [initial, today]);

  const [form, setForm] = useState(initForm);
  const [partyData, setPartyData] = useState(null);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [outstanding, setOutstanding] = useState([]);
  const [activeTab, setActiveTab] = useState('document');
  const [editingDocNo, setEditingDocNo] = useState(false);
  const [states, setStates] = useState([]);
  const [originalDocs, setOriginalDocs] = useState([]);
  const editing = !!initial?.id;

  const isRefDoc = ['sales_return', 'credit_note', 'purchase_return', 'debit_note'].includes(transactionType);
  const refDocType = isRefDoc ? (cfg.direction === 'sales' ? 'sales_invoice' : 'purchase_invoice') : null;

  const partyOptions = useMemo(() =>
    parties.map(p => ({ value: p.id, label: p.name })),
  [parties]);

  const partyMap = useMemo(() => {
    const m = {};
    parties.forEach(p => { m[p.id] = p; });
    return m;
  }, [parties]);

  const f = (key) => form[key] || '';
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (initial) {
      if (initial.items) setItems(initial.items.map(i => ({ ...i, rate: (i.rate || 0) / 100 })));
      if (initial.party_id) {
        setPartyData({
          id: initial.party_id, name: initial.party_name, gstin: initial.party_gstin,
          pan: initial.party_pan, address: initial.party_address, city: initial.party_city,
          state: initial.party_state, country: initial.party_country, postal_code: initial.party_postal_code,
        });
      }
    } else {
      const prefix = DOC_PREFIXES[transactionType] || 'DOC';
      set('document_number', `${prefix}-${Date.now().toString(36).toUpperCase()}`);
    }
  }, []);

  useEffect(() => {
    let country = 'IN';
    try { const gc = JSON.parse(localStorage.getItem('global_config')); if (gc?.defaultCountry) country = gc.defaultCountry; } catch {}
    getStates(country).then(setStates);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = cfg.partyType === 'customer' ? await hrService.getCustomers({ limit: 500 }) : await hrService.getSuppliers({ limit: 500 });
        setParties(data?.data || data || []);
      } catch { setParties([]); }
    })();
  }, []);

  useEffect(() => {
    if (!isRefDoc || !partyData?.id) { setOriginalDocs([]); return; }
    hrService.listTransactions({ transactionType: refDocType, partyId: partyData.id, limit: 200 })
      .then(r => setOriginalDocs(r?.data || []))
      .catch(() => setOriginalDocs([]));
  }, [partyData?.id, transactionType]);

  const loadOutstanding = useCallback(async (overridePartyId) => {
    const pid = overridePartyId || partyData?.id;
    if (!pid) return;
    try {
      const data = await hrService.getOutstandingTransactions({ party_id: pid, direction: cfg.direction });
      setOutstanding(data || []);
    } catch { setOutstanding([]); }
  }, [partyData?.id, cfg.direction]);

  useEffect(() => {
    if (cfg.fields.outstandingList && partyData?.id) loadOutstanding();
  }, [partyData?.id, cfg.fields.outstandingList, loadOutstanding]);

  const handlePartyChange = (id) => {
    const p = partyMap[id] || null;
    setPartyData(p);
    if (p) {
      set('party_id', p.id);
      set('party_name', p.name);
      set('party_gstin', p.gstin || '');
      set('party_pan', p.pan || '');
      set('party_address', p.billing_address || p.address || '');
      set('party_city', p.billing_city || p.city || '');
      set('party_state', p.billing_state || p.state || '');
      set('party_country', p.billing_country || p.country || 'India');
      set('party_postal_code', p.billing_postal_code || p.postal_code || '');
      set('place_of_supply', p.billing_state || p.state || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.party_id && cfg.fields.party) { setError('Please select a party.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        transaction_type: transactionType,
        ...form,
        items: items.filter(i => i.item_name).map(i => ({ ...i, rate: Math.round((i.rate || 0) * 100) })),
        gst_type: form.gst_type || 'intra',
      };
      if (editing) {
        await hrService.updateTransaction(initial.id, payload);
      } else {
        await hrService.createTransaction(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    }
    setSaving(false);
  };

  const fields = (key) => cfg?.fields?.[key];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mx-6 mt-4">{error}</div>}

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
        <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit' : 'New'} {DOC_LABELS[transactionType]}</h3>
        <select value={form.status} onChange={e => set('status', e.target.value)} className="text-sm border border-gray-300 rounded-lg px-2 py-1">
          {(STATUS_OPTIONS[transactionType] || ['draft']).filter(s => s !== 'cancelled').map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6 shrink-0">
        {TAB_KEYS.map(key => (
          <button key={key} type="button" onClick={() => setActiveTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ─── TAB 1: Invoice/Document Info ────────────── */}
        {activeTab === 'document' && (
          <div className="space-y-4">
              {fields('party') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{cfg.partyType === 'customer' ? 'Customer' : 'Supplier'}</label>
                  <SearchableSelect
                    options={partyOptions}
                    value={partyData?.id || ''}
                    onChange={handlePartyChange}
                    placeholder={cfg.partyType === 'customer' ? 'Select Customer' : 'Select Supplier'}
                  />
                  {partyData && (
                    <div className="mt-1.5 text-xs text-gray-500">
                      {partyData.gstin && <span>GST: {partyData.gstin}</span>}
                      {partyData.city && <span className="ml-3">{partyData.city}, {partyData.state}</span>}
                    </div>
                  )}
                </div>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {fields('docNumber') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
                  <div className="flex items-center gap-1">
                    <input value={f('document_number')}
                      onChange={e => set('document_number', e.target.value)}
                      className={`input-field text-sm flex-1 ${!editingDocNo && !editing ? 'bg-gray-50 text-gray-500' : ''}`}
                      placeholder="Auto-generated"
                      readOnly={!editingDocNo && !editing} />
                    {!editing && (
                      <button type="button" onClick={() => setEditingDocNo(!editingDocNo)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition-colors" title="Edit invoice number">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
              {fields('docDate') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input type="date" value={f('document_date')} onChange={e => set('document_date', e.target.value)}
                    className="input-field text-sm" />
                </div>
              )}
              {fields('dueDate') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={f('due_date')} onChange={e => set('due_date', e.target.value)}
                    className="input-field text-sm" />
                </div>
              )}
              {fields('placeOfSupply') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Place of Supply — State</label>
                  <SearchableSelect
                    options={states.map(s => ({ value: s.state_name, label: s.state_name }))}
                    value={f('place_of_supply')}
                    onChange={v => set('place_of_supply', v)}
                    placeholder="Select State"
                  />
                </div>
              )}
              {!isSalesInvoice && fields('validUntil') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input type="date" value={f('valid_until')} onChange={e => set('valid_until', e.target.value)}
                    className="input-field text-sm" />
                </div>
              )}
              {!isSalesInvoice && fields('expectedDeliveryDate') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                  <input type="date" value={f('expected_delivery_date')} onChange={e => set('expected_delivery_date', e.target.value)}
                    className="input-field text-sm" />
                </div>
              )}
              {!isSalesInvoice && fields('referenceNumber') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{cfg.fields.referenceNumber.label}</label>
                  {isRefDoc ? (
                    <SearchableSelect
                      options={originalDocs.map(d => ({ value: d.document_number, label: `${d.document_number} — ${new Date(d.document_date).toLocaleDateString('en-IN')}` }))}
                      value={f('reference_number')}
                      onChange={v => { set('reference_number', v); set('reference_type', refDocType); }}
                      placeholder={cfg.fields.referenceNumber.label}
                    />
                  ) : (
                    <input value={f('reference_number')} onChange={e => set('reference_number', e.target.value)}
                      className="input-field text-sm" placeholder={cfg.fields.referenceNumber.label} />
                  )}
                </div>
              )}
              {!isSalesInvoice && fields('challanType') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Challan Type</label>
                  <select value={f('challan_type')} onChange={e => set('challan_type', e.target.value)} className="input-field text-sm">
                    <option value="">Select</option>
                    <option value="delivery">Delivery</option>
                    <option value="sample">Sample</option>
                    <option value="return">Return</option>
                    <option value="job_work">Job Work</option>
                  </select>
                </div>
              )}
              {!isSalesInvoice && fields('paymentTerms') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <input value={f('payment_terms')} onChange={e => set('payment_terms', e.target.value)}
                    className="input-field text-sm" placeholder="e.g. Net 30" />
                </div>
              )}
              {!isSalesInvoice && fields('authorizedSignatory') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authorized Signatory</label>
                  <input value={f('authorized_signatory')} onChange={e => set('authorized_signatory', e.target.value)}
                    className="input-field text-sm" />
                </div>
              )}
              {!isSalesInvoice && fields('billingAddress') && (
                <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                    <textarea value={f('billing_address') || f('party_address')} onChange={e => set('billing_address', e.target.value)}
                      className="input-field text-sm" rows={2} />
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <input value={f('billing_city') || f('party_city')} onChange={e => set('billing_city', e.target.value)} className="input-field text-sm" placeholder="City" />
                      <input value={f('billing_state') || f('party_state')} onChange={e => set('billing_state', e.target.value)} className="input-field text-sm" placeholder="State" />
                      <input value={f('billing_postal_code') || f('party_postal_code')} onChange={e => set('billing_postal_code', e.target.value)} className="input-field text-sm" placeholder="Pincode" />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <span>Shipping Address</span>
                      <label className="flex items-center gap-1 text-xs text-gray-400 font-normal cursor-pointer">
                        <input type="checkbox" checked={form.same_as_billing} onChange={e => set('same_as_billing', e.target.checked)} className="w-3 h-3" />
                        Same as Billing
                      </label>
                    </label>
                    {form.same_as_billing ? (
                      <p className="text-xs text-gray-400 italic pt-2">Same as billing address</p>
                    ) : (
                      <>
                        <textarea value={f('shipping_address')} onChange={e => set('shipping_address', e.target.value)}
                          className="input-field text-sm" rows={2} />
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <input value={f('shipping_city')} onChange={e => set('shipping_city', e.target.value)} className="input-field text-sm" placeholder="City" />
                          <input value={f('shipping_state')} onChange={e => set('shipping_state', e.target.value)} className="input-field text-sm" placeholder="State" />
                          <input value={f('shipping_postal_code')} onChange={e => set('shipping_postal_code', e.target.value)} className="input-field text-sm" placeholder="Pincode" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              {!isSalesInvoice && (
                <div className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fields('vehicleNumber') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle No.</label>
                      <input value={f('vehicle_number')} onChange={e => set('vehicle_number', e.target.value)} className="input-field text-sm" />
                    </div>
                  )}
                  {fields('transporter') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Transporter</label>
                      <input value={f('transporter')} onChange={e => set('transporter', e.target.value)} className="input-field text-sm" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: Line Items ────────────────────────── */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            {fields('lineItems') && (
              <LineItemsTable items={items} onChange={setItems} gstType={form.gst_type || 'intra'} direction={DIRECTION[transactionType] || 'sales'} />
            )}
            {fields('reason') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={f('reason')} onChange={e => set('reason', e.target.value)} className="input-field text-sm" rows={2} />
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: Payment & Notes ───────────────────── */}
        {activeTab === 'payment' && (
          <div className="space-y-4">
            {fields('paymentMode') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                  <select value={f('payment_mode')} onChange={e => set('payment_mode', e.target.value)} className="input-field text-sm">
                    <option value="">Select</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                {fields('paymentReference') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference/Txn ID</label>
                    <input value={f('payment_reference')} onChange={e => set('payment_reference', e.target.value)} className="input-field text-sm" />
                  </div>
                )}
              </div>
            )}

            {fields('outstandingList') && partyData?.id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Outstanding {cfg.direction === 'sales' ? 'Invoices' : 'Bills'}</label>
                {outstanding.length === 0 ? (
                  <p className="text-xs text-gray-400">No outstanding documents</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {outstanding.map(doc => (
                      <label key={doc.id} className="flex items-center justify-between p-2 rounded border border-gray-100 hover:bg-gray-50 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600"
                            checked={(form.payments || []).some(p => p.allocated_to_id === doc.id)}
                            onChange={e => {
                              const current = form.payments || [];
                              if (e.target.checked) {
                                set('payments', [...current, { allocated_to_id: doc.id, allocated_to_type: transactionType === 'payment_in' ? 'sales_invoice' : 'purchase_invoice', amount_allocated: doc.balance_due }]);
                              } else {
                                set('payments', current.filter(p => p.allocated_to_id !== doc.id));
                              }
                            }} />
                          <span className="text-sm text-gray-700">{doc.doc_number}</span>
                          <span className="text-xs text-gray-400">{new Date(doc.doc_date).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-gray-500">Due: </span>
                          <span className="font-medium text-gray-900">{formatINR(doc.balance_due)}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {fields('termsConditions') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                  <textarea value={f('terms_conditions')} onChange={e => set('terms_conditions', e.target.value)} className="input-field text-sm" rows={2} />
                </div>
              )}
              {fields('notes') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={f('notes')} onChange={e => set('notes', e.target.value)} className="input-field text-sm" rows={2} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
        <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

function formatINR(val) {
  const symbol = localStorage.getItem('currency_symbol') || '₹';
  return symbol + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
