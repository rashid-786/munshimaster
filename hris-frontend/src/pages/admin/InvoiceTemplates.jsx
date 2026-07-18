import React, { useState, useEffect, useRef, useCallback } from 'react';
import { hrService } from '../../services/hr.service';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';
const logoFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url.replace(/^\/api\/v1/, '')}`;
};

const TEMPLATES = [
  { id: 'modern', name: 'Modern Professional', description: 'Clean, contemporary layout with accent colors and minimal design', features: ['Color accents', 'Clean typography', 'GST summary', 'Signature space'] },
  { id: 'classic', name: 'Classic Business', description: 'Traditional formal layout suitable for all business types', features: ['Formal layout', 'Company letterhead', 'Full border', 'Watermark support'] },
  { id: 'gst_detailed', name: 'GST Detailed', description: 'Comprehensive GST breakdown with HSN/SAC and tax rate columns', features: ['HSN/SAC column', 'GST rate per item', 'Tax rate per item', 'GST summary table'] },
  { id: 'retail_pos', name: 'Retail POS', description: 'Simple receipt-style layout optimized for retail counters', features: ['Compact layout', 'Receipt style', 'Quick print', 'Minimal fields'] },
];

const COLOR_PRESETS = ['#0F172A', '#1E40AF', '#991B1B', '#065F46', '#6D28D9', '#B45309', '#0E7490'];
const FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Times-Roman', label: 'Times Roman' },
];
const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const DEFAULT_ITEM_COLUMNS = [
  { key: 'sku', label: 'SKU', visible: false },
  { key: 'itemCode', label: 'Item Code', visible: false },
  { key: 'hsn', label: 'HSN/SAC', visible: true },
  { key: 'description', label: 'Description', visible: true },
  { key: 'unit', label: 'Unit', visible: false },
  { key: 'quantity', label: 'Quantity', visible: true },
  { key: 'rate', label: 'Rate', visible: true },
  { key: 'discount', label: 'Discount', visible: false },
  { key: 'gst', label: 'GST', visible: true },
  { key: 'total', label: 'Total', visible: true },
];

const DEFAULT_CUSTOM_LABELS = {
  invoice: 'INVOICE', invoiceNumber: 'Invoice #', invoiceDate: 'Date', dueDate: 'Due Date',
  paymentTerms: 'Payment Terms', salesPerson: 'Sales Person', billTo: 'Bill To',
  placeOfSupply: 'Place of Supply', subtotal: 'Subtotal', discountTotal: 'Discount',
  tax: 'Tax', roundOff: 'Round Off', grandTotal: 'Grand Total', amountInWords: 'Amount in Words',
  notes: 'Notes', authorizedSignatory: 'Authorized Signatory', status: 'Status',
};

function freshConfig() {
  return {
    logoUrl: '', companyName: '', gstNumber: '',
    signatureUrl: '', signatoryName: '', signatoryDesignation: '',
    primaryColor: '#0F172A', secondaryColor: '#16A34A',
    showCustomerAddress: true, showShippingAddress: true, showCustomerGst: true, showTerms: true, showSignature: true,
    logoAlignment: 'left', companyInfoPosition: 'left', customerLayout: 'left',
    showInvoiceNo: true, showInvoiceDate: true, showDueDate: true, showPaymentTerms: true, showSalesPerson: true,
    itemColumns: DEFAULT_ITEM_COLUMNS.map(c => ({ ...c })),
    showDiscountTotal: true, showGstBreakdown: true, showRoundOff: true, showAmountInWords: true,
    headerBackground: '#FFFFFF', footerBackground: '#F8FAFC', fontFamily: 'Helvetica', fontSize: 'small',
    headerHeight: 120, logoSize: 80, pageMargin: 50, sectionPadding: 16, sectionSpacing: 12,
    customLabels: { ...DEFAULT_CUSTOM_LABELS },
  };
}

const SAMPLE_INVOICE = {
  invoice_number: 'INV-2026-0042', invoice_date: '2026-07-15', due_date: '2026-08-14',
  status: 'sent', subtotal: 150000, total_amount: 177000, tax_amount: 27000,
  customer_name: 'ABC Traders', customer_address: '42, Business Avenue',
  customer_city: 'Mumbai', customer_state: 'Maharashtra',
  customer_email: 'contact@abctraders.in', customer_phone: '+91 98765 43210',
  customer_gstin: '27AABCU9603R1ZM', place_of_supply: '27-Maharashtra',
  notes: 'Thank you for your business! Payment due within 30 days.',
  payment_terms: 'Net 30', sales_person: 'Rajesh Kumar', gst_type: 'intra',
};

const SAMPLE_ITEMS = [
  { description: 'Premium Widget A', hsn_code: '847130', quantity: 10, unit_price: 5000, total_price: 50000, unit: 'pcs', gst_rate: 18 },
  { description: 'Eco-Friendly Packaging Box', hsn_code: '481910', quantity: 50, unit_price: 200, total_price: 10000, unit: 'pcs', gst_rate: 18 },
  { description: 'Industrial Lubricant - Grade A', hsn_code: '271019', quantity: 20, unit_price: 3000, total_price: 60000, unit: 'ltr', gst_rate: 18 },
  { description: 'Safety Equipment Kit', hsn_code: '902000', quantity: 15, unit_price: 2000, total_price: 30000, unit: 'set', gst_rate: 18 },
];

function fmtCurrency(paise) { return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }

const InvoiceTemplates = () => {
  const [tab, setTab] = useState('templates');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tenantTemplates, setTenantTemplates] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [marketplaceData, setMarketplaceData] = useState({ categories: [], templates: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [settings, setSettings] = useState(freshConfig());
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateDocTypes, setTemplateDocTypes] = useState(['invoice']);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [confirmCb, setConfirmCb] = useState(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmLabel, setConfirmLabel] = useState('Discard');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const fileInputRef = useRef(null);
  const sigInputRef = useRef(null);
  const savedRef = useRef(true);

  useEffect(() => {
    Promise.all([
      hrService.listTenantTemplates(),
      hrService.getDocumentTypes(),
    ]).then(([tplRes, dtRes]) => {
      setTenantTemplates(tplRes.templates || []);
      setDocumentTypes(dtRes.documentTypes || []);
      const defaultTpl = (tplRes.templates || []).find(t => t.is_default);
      if (defaultTpl) {
        selectTemplate(defaultTpl.id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = (e) => { if (!savedRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const isDirty = () => !savedRef.current;

  const update = useCallback((key, value) => {
    savedRef.current = false;
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateLabel = useCallback((key, value) => {
    savedRef.current = false;
    setSettings(prev => ({ ...prev, customLabels: { ...prev.customLabels, [key]: value } }));
  }, []);

  const selectTemplate = async (id) => {
    setLoading(true);
    try {
      const res = await hrService.getTenantTemplate(id);
      const tpl = res.template;
      setSelectedId(id);
      setTemplateName(tpl.name || '');
      setTemplateDescription(tpl.description || '');
      const dt = tpl.document_types;
      setTemplateDocTypes(Array.isArray(dt) ? dt : (typeof dt === 'string' ? JSON.parse(dt) : ['invoice']));
      const cfg = tpl.config ? (typeof tpl.config === 'string' ? JSON.parse(tpl.config) : tpl.config) : {};
      setSettings(prev => ({ ...freshConfig(), ...cfg, customLabels: { ...DEFAULT_CUSTOM_LABELS, ...(cfg.customLabels || {}) } }));
    } catch (e) {
      setMessage('Failed to load template.');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!templateName.trim()) { setMessage('Template name is required.'); return; }
    setSaving(true);
    setMessage('');
    try {
      if (selectedId) {
        await hrService.updateTenantTemplate(selectedId, { name: templateName, description: templateDescription, document_types: templateDocTypes, config: settings });
        setMessage('Template saved.');
      } else {
        const res = await hrService.createTenantTemplate({ name: templateName, description: templateDescription, document_types: templateDocTypes, config: settings });
        setSelectedId(res.template.id);
        setMessage('Template created.');
      }
      savedRef.current = true;
      const tplRes = await hrService.listTenantTemplates();
      setTenantTemplates(tplRes.templates || []);
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to save.');
    }
    setSaving(false);
  };

  const handleCreateNew = () => {
    const proceed = () => {
      setSelectedId(null);
      setTemplateName('');
      setTemplateDescription('');
      setTemplateDocTypes(['invoice']);
      setSettings(freshConfig());
      savedRef.current = true;
      setTab('editor');
    };
    if (!savedRef.current) { setConfirmMsg('Discard unsaved changes?'); setConfirmLabel('Discard'); setConfirmDanger(false); setConfirmCb(() => proceed); }
    else proceed();
  };

  const handleClone = async (id) => {
    try {
      await hrService.cloneTenantTemplate(id);
      setMessage('Template cloned.');
      const r = await hrService.listTenantTemplates();
      setTenantTemplates(r.templates || []);
    } catch (e) { setMessage('Failed to clone.'); }
  };

  const handleDelete = (id) => {
    setConfirmMsg('Delete this template?'); setConfirmLabel('Delete'); setConfirmDanger(true);
    setConfirmCb(() => async () => {
      try {
        await hrService.deleteTenantTemplate(id);
        if (selectedId === id) { setSelectedId(null); setSettings(freshConfig()); }
        const r = await hrService.listTenantTemplates();
        setTenantTemplates(r.templates || []);
        setMessage('Template deleted.');
      } catch (e) { setMessage('Failed to delete.'); }
    });
  };

  const handleSetDefault = async (id) => {
    try {
      await hrService.setDefaultTenantTemplate(id);
      const r = await hrService.listTenantTemplates();
      setTenantTemplates(r.templates || []);
      setMessage('Default template updated.');
    } catch (e) { setMessage('Failed to set default.'); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await hrService.uploadInvoiceLogo(fd);
      if (res?.url) { update('logoUrl', res.url); setMessage('Logo uploaded.'); }
    } catch { setMessage('Failed to upload logo.'); }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('signature', file);
    try {
      const res = await hrService.uploadInvoiceSignature(fd);
      if (res?.url) { update('signatureUrl', res.url); setMessage('Signature uploaded.'); }
    } catch { setMessage('Failed to upload signature.'); }
  };

  const handleRemoveSignature = async () => {
    try {
      await hrService.removeInvoiceSignature();
      update('signatureUrl', '');
      setMessage('Signature removed.');
    } catch { setMessage('Failed to remove signature.'); }
  };

  const toggleColumn = (key) => {
    savedRef.current = false;
    setSettings(p => ({ ...p, itemColumns: p.itemColumns.map(c => c.key === key ? { ...c, visible: !c.visible } : c) }));
  };

  const moveColumn = (idx, dir) => {
    savedRef.current = false;
    setSettings(p => {
      const cols = [...p.itemColumns];
      const t = idx + dir;
      if (t < 0 || t >= cols.length) return p;
      [cols[idx], cols[t]] = [cols[t], cols[idx]];
      return { ...p, itemColumns: cols };
    });
  };

  const loadMarketplace = async () => {
    try {
      const res = await hrService.listMarketplaceTemplates();
      setMarketplaceData(res);
      setTab('marketplace');
    } catch { setMessage('Failed to load marketplace.'); }
  };

  const handleActivateMarketplace = async (id) => {
    try {
      await hrService.activateMarketplaceTemplate(id);
      setMessage('Marketplace template activated.');
      const r = await hrService.listTenantTemplates();
      setTenantTemplates(r.templates || []);
    } catch (e) { setMessage('Failed to activate.'); }
  };

  const handleDocTypeToggle = (code) => {
    setTemplateDocTypes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
    savedRef.current = false;
  };

  if (loading && !tenantTemplates.length) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const renderEditor = () => (
    <div className="flex gap-6">
      {/* Settings Panel */}
      <div className="w-full lg:w-1/2 xl:w-3/5 space-y-5 overflow-y-auto max-h-[calc(100vh-260px)] pr-2">
        {message && (
          <div className={`text-sm px-4 py-3 rounded-lg flex items-center justify-between ${
            message.includes('success') || message.includes('created') || message.includes('saved') || message.includes('updated') || message.includes('deleted') || message.includes('uploaded') || message.includes('activated')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="underline font-medium">Dismiss</button>
          </div>
        )}

        {/* Template Name + Doc Types */}
        <Section title="Template Info">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Template Name</label>
              <input type="text" value={templateName} onChange={e => { setTemplateName(e.target.value); savedRef.current = false; }}
                className="input-field text-sm" placeholder="My Invoice Template" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={templateDescription} onChange={e => { setTemplateDescription(e.target.value); savedRef.current = false; }}
                className="input-field text-sm" placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Apply to Document Types</label>
              <div className="flex flex-wrap gap-1.5">
                {documentTypes.map(dt => (
                  <button key={dt.code} type="button" onClick={() => handleDocTypeToggle(dt.code)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      templateDocTypes.includes(dt.code) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {dt.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Logo + Company */}
        <Section title="Branding">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                  {settings.logoUrl ? <img src={logoFullUrl(settings.logoUrl)} alt="" className="w-full h-full object-contain" />
                    : <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs">Upload</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" value={settings.companyName} onChange={e => update('companyName', e.target.value)} className="input-field text-sm" placeholder="Your Company" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">GST Number</label>
              <input type="text" value={settings.gstNumber} onChange={e => update('gstNumber', e.target.value)} className="input-field text-sm" placeholder="22AAAAA0000A1Z5" />
            </div>
          </div>
        </Section>

        {/* Header Config */}
        <Section title="Header">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RadioGroup label="Logo Alignment" value={settings.logoAlignment} onChange={v => update('logoAlignment', v)}
              options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
            <RadioGroup label="Company Info Position" value={settings.companyInfoPosition} onChange={v => update('companyInfoPosition', v)}
              options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'center', label: 'Center' }]} />
          </div>
        </Section>

        <Section title="Customer">
          <RadioGroup label="Customer Block Position" value={settings.customerLayout} onChange={v => update('customerLayout', v)}
            options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'two_column', label: 'Two Column' }]} />
        </Section>

        <Section title="Invoice Info">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Toggle label="Invoice No" checked={settings.showInvoiceNo} onChange={v => update('showInvoiceNo', v)} />
            <Toggle label="Date" checked={settings.showInvoiceDate} onChange={v => update('showInvoiceDate', v)} />
            <Toggle label="Due Date" checked={settings.showDueDate} onChange={v => update('showDueDate', v)} />
            <Toggle label="Payment Terms" checked={settings.showPaymentTerms} onChange={v => update('showPaymentTerms', v)} />
            <Toggle label="Sales Person" checked={settings.showSalesPerson} onChange={v => update('showSalesPerson', v)} />
          </div>
        </Section>

        <Section title="Item Columns">
          <p className="text-xs text-gray-400 mb-2">Toggle and reorder columns.</p>
          <div className="space-y-1.5">
            {settings.itemColumns.map((col, idx) => (
              <div key={col.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex flex-col gap-px">
                  <button type="button" onClick={() => moveColumn(idx, -1)} disabled={idx === 0}
                    className="w-4 h-3 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button type="button" onClick={() => moveColumn(idx, 1)} disabled={idx === settings.itemColumns.length - 1}
                    className="w-4 h-3 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.key)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-medium text-gray-700">{col.label}</span>
                </label>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Summary">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Toggle label="Discount" checked={settings.showDiscountTotal} onChange={v => update('showDiscountTotal', v)} />
            <Toggle label="GST Breakdown" checked={settings.showGstBreakdown} onChange={v => update('showGstBreakdown', v)} />
            <Toggle label="Round Off" checked={settings.showRoundOff} onChange={v => update('showRoundOff', v)} />
            <Toggle label="Amount in Words" checked={settings.showAmountInWords} onChange={v => update('showAmountInWords', v)} />
          </div>
        </Section>

        <Section title="Visibility">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Toggle label="Customer Address" checked={settings.showCustomerAddress} onChange={v => update('showCustomerAddress', v)} />
            <Toggle label="Shipping Address" checked={settings.showShippingAddress} onChange={v => update('showShippingAddress', v)} />
            <Toggle label="Customer GST" checked={settings.showCustomerGst} onChange={v => update('showCustomerGst', v)} />
            <Toggle label="Terms" checked={settings.showTerms} onChange={v => update('showTerms', v)} />
            <Toggle label="Signature" checked={settings.showSignature} onChange={v => update('showSignature', v)} />
          </div>
        </Section>

        <Section title="Theme">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField label="Primary Color" value={settings.primaryColor} onChange={v => update('primaryColor', v)} presets={COLOR_PRESETS} />
            <ColorField label="Secondary Color" value={settings.secondaryColor} onChange={v => update('secondaryColor', v)} />
            <ColorField label="Header Background" value={settings.headerBackground} onChange={v => update('headerBackground', v)} />
            <ColorField label="Footer Background" value={settings.footerBackground} onChange={v => update('footerBackground', v)} />
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Family</label>
              <select value={settings.fontFamily} onChange={e => update('fontFamily', e.target.value)} className="input-field text-sm">
                {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
              <RadioGroup value={settings.fontSize} onChange={v => update('fontSize', v)} options={SIZE_OPTIONS} />
            </div>
          </div>
        </Section>

        <Section title="Spacing">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Slider label="Header Height" value={settings.headerHeight} min={60} max={200} step={5} unit="px" onChange={v => update('headerHeight', v)} />
            <Slider label="Logo Size" value={settings.logoSize} min={40} max={160} step={5} unit="px" onChange={v => update('logoSize', v)} />
            <Slider label="Page Margin" value={settings.pageMargin} min={20} max={80} step={5} unit="px" onChange={v => update('pageMargin', v)} />
            <Slider label="Padding" value={settings.sectionPadding} min={4} max={32} step={2} unit="px" onChange={v => update('sectionPadding', v)} />
            <Slider label="Spacing" value={settings.sectionSpacing} min={4} max={32} step={2} unit="px" onChange={v => update('sectionSpacing', v)} />
          </div>
        </Section>

        <Section title="Custom Labels">
          <p className="text-xs text-gray-400 mb-3">Rename labels as needed.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries({
              invoice: 'Invoice Title', invoiceNumber: 'Invoice Number', invoiceDate: 'Invoice Date',
              dueDate: 'Due Date', paymentTerms: 'Payment Terms', salesPerson: 'Sales Person',
              billTo: 'Bill To', placeOfSupply: 'Place of Supply', subtotal: 'Subtotal',
              discountTotal: 'Discount', tax: 'Tax', roundOff: 'Round Off', grandTotal: 'Grand Total',
              amountInWords: 'Amount in Words', notes: 'Notes', authorizedSignatory: 'Authorized Signatory', status: 'Status',
            }).map(([key, label]) => (
              <LabelInput key={key} label={label} value={settings.customLabels[key] || ''} onChange={v => updateLabel(key, v)} />
            ))}
          </div>
        </Section>

        {/* Authorized Signatory */}
        <Section title="Authorized Signatory">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                {settings.signatureUrl
                  ? <img src={logoFullUrl(settings.signatureUrl)} alt="Signature" className="w-full h-full object-contain" style={{ maxHeight: '100%' }} />
                  : <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
              </div>
              <div className="flex flex-col gap-1.5">
                <button type="button" onClick={() => sigInputRef.current?.click()} className="btn-secondary text-xs">Upload Signature</button>
                {settings.signatureUrl && (
                  <button type="button" onClick={handleRemoveSignature} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                )}
                <input ref={sigInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleSignatureUpload} className="hidden" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Signatory Name</label>
                <input type="text" value={settings.signatoryName || ''} onChange={e => update('signatoryName', e.target.value)} className="input-field text-sm" placeholder="Rajesh Kumar" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Designation / Role</label>
                <input type="text" value={settings.signatoryDesignation || ''} onChange={e => update('signatoryDesignation', e.target.value)} className="input-field text-sm" placeholder="Finance Manager" />
              </div>
            </div>
            <Toggle label="Display Authorized Signatory on Invoices" checked={settings.showSignature !== false} onChange={v => update('showSignature', v)} />
          </div>
        </Section>

        {/* Merge Tags Reference */}
        <Section title="Merge Tags">
          <p className="text-xs text-gray-400 mb-2">Available merge tags for custom templates.</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              '{{company_name}}', '{{company_logo}}', '{{company_gst}}',
              '{{customer_name}}', '{{customer_address}}', '{{customer_gst}}',
              '{{invoice_number}}', '{{invoice_date}}', '{{due_date}}',
              '{{subtotal}}', '{{discount}}', '{{tax}}', '{{grand_total}}', '{{amount_words}}',
              '{{invoice_items}}', '{{notes}}', '{{terms}}',
            ].map(tag => (
              <code key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{tag}</code>
            ))}
          </div>
        </Section>
      </div>

      {/* Preview Panel */}
      <div className="hidden lg:block lg:w-1/2 xl:w-2/5 sticky top-0 self-start">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-600">Live Preview</span>
            <div className="flex gap-1">
              {['desktop', 'mobile', 'pdf'].map(mode => (
                <button key={mode} onClick={() => setPreviewMode(mode)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    previewMode === mode ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {mode === 'pdf' ? 'PDF' : mode}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start justify-center p-4 bg-gray-100 min-h-[500px]">
            <div className={`bg-white shadow-lg transition-all ${
              previewMode === 'mobile' ? 'w-[375px]' : previewMode === 'pdf' ? 'w-[595px]' : 'w-full max-w-[595px]'
            }`}>
              <InvoicePreview settings={settings} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Global Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Invoice Templates</h2>
          {!savedRef.current && <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />}
        </div>
        {tab === 'editor' && (
          <button onClick={handleSave} disabled={saving}
            className={`btn-primary text-sm ${!savedRef.current ? 'ring-2 ring-amber-400' : ''}`}>
            {saving ? 'Saving...' : !savedRef.current ? 'Save Changes' : 'Save'}
          </button>
        )}
      </div>

      {tab !== 'editor' && message && (
        <div className={`text-sm px-4 py-3 rounded-lg flex items-center justify-between ${
          message.includes('success') || message.includes('created') || message.includes('activated') || message.includes('deleted') || message.includes('saved') || message.includes('uploaded')
            ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="underline font-medium">Dismiss</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <TabBtn active={tab === 'templates'} onClick={() => { if (!savedRef.current) { setConfirmMsg('Discard unsaved changes?'); setConfirmLabel('Discard'); setConfirmDanger(false); setConfirmCb(() => () => setTab('templates')); } else { setTab('templates'); } }}>My Templates</TabBtn>
        <TabBtn active={tab === 'editor'} onClick={() => setTab('editor')}>
          {selectedId ? 'Edit Template' : 'New Template'}
        </TabBtn>
        <TabBtn active={tab === 'marketplace'} onClick={() => { if (!savedRef.current) { setConfirmMsg('Discard unsaved changes?'); setConfirmLabel('Discard'); setConfirmDanger(false); setConfirmCb(() => () => { setTab('marketplace'); loadMarketplace(); }); } else { setTab('marketplace'); loadMarketplace(); } }}>Marketplace</TabBtn>
      </div>

      {/* Templates List */}
      {tab === 'templates' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{tenantTemplates.length} template(s)</p>
            <button onClick={handleCreateNew} className="btn-primary text-sm">+ New Template</button>
          </div>
          {tenantTemplates.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 text-sm mb-3">No templates yet. Create one or browse the marketplace.</p>
              <div className="flex justify-center gap-3">
                <button onClick={handleCreateNew} className="btn-primary text-sm">Create Template</button>
                <button onClick={() => { setTab('marketplace'); loadMarketplace(); }} className="btn-secondary text-sm">Browse Marketplace</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tenantTemplates.map(tpl => (
                <div key={tpl.id}
                  className={`card p-4 cursor-pointer transition-all border-2 ${
                    selectedId === tpl.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={() => { selectTemplate(tpl.id); setTab('editor'); }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</p>
                        {tpl.is_default && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Default</span>}
                      </div>
                      {tpl.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{tpl.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">
                        Source: {tpl.source || 'custom'} &middot; {Array.isArray(tpl.document_types) ? tpl.document_types.length : 0} doc type(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                    <button onClick={(e) => { e.stopPropagation(); selectTemplate(tpl.id); setTab('editor'); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    {!tpl.is_default && <button onClick={(e) => { e.stopPropagation(); handleSetDefault(tpl.id); }}
                      className="text-xs text-gray-500 hover:text-gray-700">Set Default</button>}
                    <button onClick={(e) => { e.stopPropagation(); handleClone(tpl.id); }}
                      className="text-xs text-gray-500 hover:text-gray-700">Clone</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }}
                      className="text-xs text-red-500 hover:text-red-700 ml-auto">Delete</button>
                  </div>
                </div>
              ))}
              <div onClick={() => { setTab('marketplace'); loadMarketplace(); }}
                className="card p-4 border-2 border-dashed border-gray-200 hover:border-indigo-300 cursor-pointer flex items-center justify-center min-h-[120px] transition-colors">
                <div className="text-center">
                  <svg className="w-8 h-8 text-gray-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                  <p className="text-xs font-medium text-gray-500">Browse Marketplace</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {tab === 'editor' && renderEditor()}

      {/* Marketplace */}
      {tab === 'marketplace' && (
        <div className="space-y-6">
          {message && (
            <div className={`text-sm px-4 py-3 rounded-lg flex items-center justify-between ${
              message.includes('success') || message.includes('activated')
                ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <span>{message}</span>
              <button onClick={() => setMessage('')} className="underline font-medium">Dismiss</button>
            </div>
          )}
          {marketplaceData.categories.map(cat => {
            const catTemplates = marketplaceData.templates.filter(t => t.category_id === cat.id);
            if (!catTemplates.length) return null;
            return (
              <div key={cat.id}>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{cat.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catTemplates.map(tpl => {
                    const alreadyActivated = tenantTemplates.some(tt => tt.source_template_id === tpl.id);
                    return (
                      <div key={tpl.id} className="card p-4 border border-gray-200">
                        <div className="aspect-[3/2] rounded-lg mb-3 overflow-hidden border border-gray-100 bg-white">
                          {(() => {
                            const tplConfig = typeof tpl.config === 'string' ? JSON.parse(tpl.config) : (tpl.config || {});
                            return <div style={{ width: 600, height: 400, transform: 'scale(0.5)', transformOrigin: 'top left' }}><InvoicePreview settings={{ ...freshConfig(), ...tplConfig, customLabels: { ...DEFAULT_CUSTOM_LABELS, ...(tplConfig.customLabels || {}) } }} /></div>;
                          })()}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{tpl.name}</p>
                        {tpl.description && <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(tpl.document_types || []).map(dt => {
                            const dtDef = documentTypes.find(d => d.code === dt);
                            return <span key={dt} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{dtDef?.name || dt}</span>;
                          })}
                        </div>
                        <button onClick={() => handleActivateMarketplace(tpl.id)} disabled={alreadyActivated}
                          className={`mt-3 w-full text-xs py-1.5 rounded-lg font-medium transition-colors ${
                            alreadyActivated ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                          }`}>
                          {alreadyActivated ? 'Activated' : 'Activate Template'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {(!marketplaceData.categories || marketplaceData.categories.length === 0) && (
            <div className="card p-8 text-center">
              <p className="text-gray-500 text-sm">No marketplace templates available yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirmCb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setConfirmCb(null); setConfirmMsg(''); }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmMsg}</h3>
            {confirmMsg === 'Discard unsaved changes?' && <p className="text-sm text-gray-500 mb-6">You have unsaved changes that will be lost if you leave this page.</p>}
            {confirmMsg === 'Delete this template?' && <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setConfirmCb(null); setConfirmMsg(''); }} className="btn-secondary text-sm">Cancel</button>
              <button onClick={() => { confirmCb(); setConfirmCb(null); setConfirmMsg(''); }} className={`btn-primary text-sm ${confirmDanger ? 'bg-red-600 hover:bg-red-700' : ''}`}>{confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== LIVE PREVIEW ====================

function InvoicePreview({ settings }) {
  const s = settings;
  const cl = s.customLabels || {};
  const lbl = (k, fb) => cl[k] || fb;
  const prim = s.primaryColor || '#0F172A';
  const sec = s.secondaryColor || '#16A34A';
  const ff = s.fontFamily === 'Times-Roman' ? 'serif' : s.fontFamily === 'Courier' ? 'monospace' : 'Helvetica, Arial, sans-serif';
  const base = s.fontSize === 'large' ? 11 : s.fontSize === 'medium' ? 10 : 9;
  const titleS = s.fontSize === 'large' ? 20 : s.fontSize === 'medium' ? 18 : 16;
  const headS = s.fontSize === 'large' ? 13 : s.fontSize === 'medium' ? 12 : 11;
  const margin = s.pageMargin || 50;
  const spacing = s.sectionSpacing || 12;

  const visibleCols = (s.itemColumns || []).filter(c => c.visible);
  const cw = { sku: 55, itemCode: 55, hsn: 60, description: 0, unit: 40, quantity: 42, rate: 55, discount: 50, gst: 50, total: 60 };
  const ca = { sku: 'center', itemCode: 'center', hsn: 'center', description: 'left', unit: 'center', quantity: 'right', rate: 'right', discount: 'right', gst: 'right', total: 'right' };
  const oth = visibleCols.reduce((s, c) => s + (c.key === 'description' ? 0 : (cw[c.key] || 55)), 0);
  const dw = visibleCols.find(c => c.key === 'description') ? Math.max(80, 500 - oth - 25) : 0;

  const labelS = { fontWeight: 600, color: prim, fontFamily: ff, fontSize: base };

  const infoLines = [];
  if (s.showInvoiceNo !== false) infoLines.push({ label: lbl('invoiceNumber', 'Invoice #'), value: SAMPLE_INVOICE.invoice_number });
  if (s.showInvoiceDate !== false) infoLines.push({ label: lbl('invoiceDate', 'Date'), value: fmtDate(SAMPLE_INVOICE.invoice_date) });
  if (s.showDueDate !== false) infoLines.push({ label: lbl('dueDate', 'Due Date'), value: fmtDate(SAMPLE_INVOICE.due_date) });
  if (s.showPaymentTerms !== false) infoLines.push({ label: lbl('paymentTerms', 'Payment Terms'), value: SAMPLE_INVOICE.payment_terms });
  if (s.showSalesPerson !== false) infoLines.push({ label: lbl('salesPerson', 'Sales Person'), value: SAMPLE_INVOICE.sales_person });

  const custLines = [
    SAMPLE_INVOICE.customer_name,
    s.showCustomerAddress !== false ? SAMPLE_INVOICE.customer_address : null,
    s.showCustomerAddress !== false ? `${SAMPLE_INVOICE.customer_city}, ${SAMPLE_INVOICE.customer_state}` : null,
    `Email: ${SAMPLE_INVOICE.customer_email}`, `Phone: ${SAMPLE_INVOICE.customer_phone}`,
    s.showCustomerGst !== false ? `GSTIN: ${SAMPLE_INVOICE.customer_gstin}` : null,
    `${lbl('placeOfSupply', 'Place of Supply')}: ${SAMPLE_INVOICE.place_of_supply}`,
  ].filter(Boolean);

  return (
    <div style={{ padding: margin, fontFamily: ff, background: '#fff' }}>
      <div style={{ position: 'relative', minHeight: s.logoSize || 80 }}>
        {s.logoUrl && (
          <img src={logoFullUrl(s.logoUrl)} alt="" style={{
            position: 'absolute', width: s.logoSize || 80, height: 'auto',
            top: 0,
            ...(s.logoAlignment === 'right' ? { right: 0 } : s.logoAlignment === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { left: 0 }),
          }} />
        )}
        <div style={{ textAlign: s.companyInfoPosition === 'right' ? 'right' : s.companyInfoPosition === 'center' ? 'center' : 'left' }}>
          <div style={{ fontSize: titleS, fontWeight: 700, color: prim }}>{s.companyName || 'Your Company'}</div>
          <div style={{ fontSize: headS, fontWeight: 700, color: '#374151' }}>{lbl('invoice', 'INVOICE')}</div>
        </div>
      </div>
      <div style={{ height: spacing }} />
      {s.customerLayout === 'two_column' || s.customerLayout === 'right' ? (
        <div style={{ display: 'flex', gap: margin, fontSize: base }}>
          <div style={{ flex: 1 }}>
            <div style={labelS}>{lbl('billTo', 'Bill To')}:</div>
            {custLines.map((l, i) => <div key={i} style={{ color: '#374151', marginTop: 1 }}>{l}</div>)}
          </div>
          <div style={{ flex: 1 }}>{infoLines.map((il, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, fontSize: base, fontFamily: ff }}>
              <span style={{ fontWeight: 600, color: prim }}>{il.label}:</span>
              <span style={{ color: '#374151' }}>{il.value}</span>
            </div>
          ))}</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: base }}>
            <div style={labelS}>{lbl('billTo', 'Bill To')}:</div>
            {custLines.map((l, i) => <div key={i} style={{ color: '#374151', marginTop: 1 }}>{l}</div>)}
          </div>
          <div style={{ height: spacing }} />
          {infoLines.map((il, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, fontSize: base, fontFamily: ff }}>
              <span style={{ fontWeight: 600, color: prim }}>{il.label}:</span>
              <span style={{ color: '#374151' }}>{il.value}</span>
            </div>
          ))}
        </>
      )}
      <div style={{ height: spacing }} />
      <div style={{ fontSize: base + 1, fontWeight: 700, color: sec }}>{lbl('status', 'Status')}: {SAMPLE_INVOICE.status.toUpperCase()}</div>
      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: `${spacing}px 0` }} />

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: base - 1, fontFamily: ff }}>
        <thead>
          <tr style={{ background: prim, color: '#fff' }}>
            <th style={{ padding: '3px 4px', textAlign: 'center', width: 25 }}>#</th>
            {visibleCols.map(col => (
              <th key={col.key} style={{ padding: '3px 4px', textAlign: ca[col.key] || 'left', width: cw[col.key] || 55 }}>
                {lbl(col.key, col.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ITEMS.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
              <td style={{ padding: '3px 4px', textAlign: 'center', color: '#374151' }}>{i + 1}</td>
              {visibleCols.map(col => (
                <td key={col.key} style={{ padding: '3px 4px', textAlign: ca[col.key] || 'left', color: '#374151' }}>
                  {col.key === 'description' && item.description}
                  {col.key === 'hsn' && (item.hsn_code || '—')}
                  {col.key === 'quantity' && item.quantity}
                  {col.key === 'rate' && fmtCurrency(item.unit_price)}
                  {col.key === 'total' && fmtCurrency(item.total_price)}
                  {col.key === 'gst' && `${item.gst_rate || 0}%`}
                  {col.key === 'unit' && (item.unit || '—')}
                  {col.key === 'discount' && '—'}
                  {col.key === 'sku' && '—'}
                  {col.key === 'itemCode' && '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: spacing, fontSize: base, fontFamily: ff }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: 260, marginBottom: 2 }}>
          <span style={labelS}>{lbl('subtotal', 'Subtotal')}:</span><span>{fmtCurrency(SAMPLE_INVOICE.subtotal)}</span>
        </div>
        {s.showGstBreakdown !== false && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: 260, marginBottom: 2 }}>
              <span style={labelS}>GST @ 18%:</span><span>{fmtCurrency(27000)}</span>
            </div>
          </>
        )}
        {s.showRoundOff !== false && (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 260, marginBottom: 2 }}>
            <span style={labelS}>{lbl('roundOff', 'Round Off')}:</span><span>0.00</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: 260, padding: '4px 8px', background: prim, color: '#fff', fontWeight: 700, fontSize: base + 2, borderRadius: 4 }}>
          <span>{lbl('grandTotal', 'Grand Total')}:</span><span>{fmtCurrency(SAMPLE_INVOICE.total_amount)}</span>
        </div>
        {s.showAmountInWords !== false && (
          <div style={{ marginTop: spacing, textAlign: 'right', fontSize: base, fontFamily: ff }}>
            <span style={labelS}>{lbl('amountInWords', 'Amount in Words')}:</span>
            <div style={{ fontWeight: 600, color: '#374151', marginTop: 2 }}>Rupees One Lakh Seventy-Seven Thousand Only</div>
          </div>
        )}
      </div>

      {s.showTerms !== false && SAMPLE_INVOICE.notes && (
        <div style={{ marginTop: spacing, fontSize: base, fontFamily: ff }}>
          <div style={labelS}>{lbl('notes', 'Notes')}:</div>
          <div style={{ color: '#374151', marginTop: 2 }}>{SAMPLE_INVOICE.notes}</div>
        </div>
      )}

      {s.showSignature !== false && (
        <div style={{ marginTop: spacing * 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          {s.signatureUrl && (
            <img src={logoFullUrl(s.signatureUrl)} alt="Signature" style={{ maxWidth: 130, maxHeight: 40, marginBottom: 4, objectFit: 'contain' }} />
          )}
          {s.signatoryName && (
            <div style={{ fontSize: base, color: '#374151', fontWeight: 600, textAlign: 'center' }}>{s.signatoryName}</div>
          )}
          {s.signatoryDesignation && (
            <div style={{ fontSize: base - 1, color: '#6b7280', textAlign: 'center', marginBottom: 2 }}>{s.signatoryDesignation}</div>
          )}
          <div style={{ width: 130, borderTop: '1px solid #9ca3af', marginBottom: 4 }} />
          <div style={{ fontSize: base - 1, color: '#6b7280', textAlign: 'center', width: 130 }}>
            {lbl('authorizedSignatory', 'Authorized Signatory')}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
        active ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
      }`}>
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
      <div className="card p-4">{children}</div>
    </div>
  );
}

function RadioGroup({ label, value, onChange, options }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              value === opt.value ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors">
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-500 font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
    </div>
  );
}

function LabelInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
    </div>
  );
}

function ColorField({ label, value, onChange, presets }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded cursor-pointer border border-gray-200 p-0.5" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="input-field w-24 font-mono text-xs" />
        {presets && <div className="flex gap-1">{presets.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`w-5 h-5 rounded-full border-2 ${value === c ? 'border-gray-900' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}</div>}
      </div>
    </div>
  );
}

export default InvoiceTemplates;
