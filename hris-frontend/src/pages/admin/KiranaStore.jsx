import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR, formatPhone } from '../../utils/currency';
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const INNER_TABS = [
  { key: 'buyers', label: 'Buyers' },
  { key: 'sellers', label: 'Sellers' },
  { key: 'cashbook', label: 'Cashbook' },
  { key: 'reports', label: 'Reports' },
];

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right ml-2">{value || '—'}</span>
  </div>
);

const KiranaStore = () => {
  const { tab: urlTab } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState(urlTab || 'buyers');
  const [partyType, setPartyType] = useState(urlTab === 'sellers' ? 'seller' : 'buyer');
  const [parties, setParties] = useState([]);
  const [summary, setSummary] = useState({ youWillGet: 0, youWillGive: 0, net: 0 });
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: '', phone: '', address: '', amount: '', direction: 'to_receive', entryDate: new Date().toISOString().split('T')[0], note: '' });
  const [editingParty, setEditingParty] = useState(null);
  const [txForm, setTxForm] = useState({ type: 'given', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Cashbook
  const [cashEntries, setCashEntries] = useState([]);
  const [cashSummary, setCashSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [cashStart, setCashStart] = useState('');
  const [cashEnd, setCashEnd] = useState('');
  const [showCashForm, setShowCashForm] = useState(false);
  const [editingCash, setEditingCash] = useState(null);
  const [cashForm, setCashForm] = useState({ type: 'IN', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
  const [cashAttachments, setCashAttachments] = useState({});
  const [cashUploadFiles, setCashUploadFiles] = useState([]);

  // Mobile state
  const [selectedParty, setSelectedParty] = useState(null);
  const [mobileTxForm, setMobileTxForm] = useState({ type: 'given', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
  const [selectedCash, setSelectedCash] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchParties = useCallback(async () => {
    try {
      const params = { type: partyType };
      if (search) params.search = search;
      const data = await hrService.kirana.getParties(params);
      setParties(data);
    } catch {}
  }, [partyType, search]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await hrService.kirana.getSummary({});
      setSummary(data);
    } catch {}
  }, []);

  useEffect(() => { fetchParties(); fetchSummary(); }, [fetchParties, fetchSummary]);

  const loadCashAttachments = async (entryId) => {
    try {
      const res = await hrService.getAttachments('kirana_cashbook', entryId);
      setCashAttachments(prev => ({ ...prev, [entryId]: res }));
    } catch {}
  };

  const fetchCashbook = useCallback(async () => {
    try {
      const params = {};
      if (cashStart) params.startDate = cashStart;
      if (cashEnd) params.endDate = cashEnd;
      const data = await hrService.kirana.getCashbook(params);
      setCashEntries(data.entries);
      setCashSummary(data.summary);
      data.entries.forEach(e => { if (!cashAttachments[e.id]) loadCashAttachments(e.id); });
    } catch {}
  }, [cashStart, cashEnd]);

  useEffect(() => {
    if (urlTab && urlTab !== tab) {
      setTab(urlTab);
      if (urlTab === 'buyers' || urlTab === 'sellers') setPartyType(urlTab === 'buyers' ? 'buyer' : 'seller');
    }
  }, [urlTab]);

  useEffect(() => {
    if (tab === 'cashbook') fetchCashbook();
  }, [tab, fetchCashbook]);

  const openDetail = async (party) => {
    try {
      const data = await hrService.kirana.getPartyDetails(party.id);
      setDetail(data);
    } catch {}
  };

  const handleAddParty = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingParty) {
        await hrService.kirana.updateParty(editingParty.id, partyForm);
      } else {
        await hrService.kirana.createParty({ type: partyForm.partyType || partyType, ...partyForm });
      }
      setShowPartyForm(false);
      setEditingParty(null);
      setPartyForm({ name: '', phone: '', address: '', amount: '', direction: 'to_receive', entryDate: new Date().toISOString().split('T')[0], note: '' });
      fetchParties();
      fetchSummary();
    } catch (err) { setMessage(err.response?.data?.error || 'Failed.'); }
    setSaving(false);
  };

  const openEditParty = (party) => {
    setEditingParty(party);
    setPartyForm({
      partyType: party.type,
      name: party.name,
      phone: party.phone || '',
      address: party.address || '',
      amount: '',
      direction: 'to_receive',
      entryDate: new Date().toISOString().split('T')[0],
      note: '',
    });
    setShowPartyForm(true);
  };

  const handleAddTx = async (e) => {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    try {
      await hrService.kirana.createTransaction({ partyId: detail.party.id, ...txForm });
      setTxForm({ type: 'given', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
      const data = await hrService.kirana.getPartyDetails(detail.party.id);
      setDetail(data);
      fetchParties();
      fetchSummary();
    } catch (err) { setMessage(err.response?.data?.error || 'Failed.'); }
    setSaving(false);
  };

  const handleDeleteTx = async (id) => {
    try {
      await hrService.kirana.deleteTransaction(id);
      const data = await hrService.kirana.getPartyDetails(detail.party.id);
      setDetail(data);
      fetchParties();
      fetchSummary();
    } catch {}
    setModal(null);
  };

  // Cashbook handlers
  const handleAddCash = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingCash) {
        await hrService.kirana.updateCashEntry(editingCash.id, cashForm);
      } else {
        const res = await hrService.kirana.createCashEntry(cashForm);
        if (cashUploadFiles.length > 0) {
          await hrService.uploadFiles('kirana_cashbook', res.id, cashUploadFiles, () => {});
        }
      }
      setShowCashForm(false);
      setEditingCash(null);
      setCashUploadFiles([]);
      setCashForm({ type: 'IN', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
      fetchCashbook();
    } catch (err) { setMessage(err.response?.data?.error || 'Failed.'); }
    setSaving(false);
  };

  const openEditCash = (entry) => {
    setEditingCash(entry);
    setCashForm({
      type: entry.type,
      amount: (entry.amount / 100).toFixed(2),
      note: entry.note || '',
      entryDate: entry.entry_date ? entry.entry_date.split('T')[0] : '',
    });
    setCashUploadFiles([]);
    setShowCashForm(true);
  };

  const handleDeleteCash = async (id) => {
    try {
      await hrService.kirana.deleteCashEntry(id);
      fetchCashbook();
    } catch {}
    setModal(null);
  };

  // Mobile handlers
  const handlePartyRowClick = async (party) => {
    if (!isMobile) {
      openDetail(party);
      return;
    }
    try {
      const data = await hrService.kirana.getPartyDetails(party.id);
      setSelectedParty(data);
      setMobileTxForm({ type: 'given', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
    } catch {}
  };

  const handleMobileAddTx = async (e) => {
    e.preventDefault();
    if (!selectedParty) return;
    setSaving(true);
    try {
      await hrService.kirana.createTransaction({ partyId: selectedParty.party.id, ...mobileTxForm });
      setMobileTxForm({ type: 'given', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
      const data = await hrService.kirana.getPartyDetails(selectedParty.party.id);
      setSelectedParty(data);
      fetchParties();
      fetchSummary();
    } catch (err) { setMessage(err.response?.data?.error || 'Failed.'); }
    setSaving(false);
  };

  const handleMobileDeleteTx = async (id) => {
    try {
      await hrService.kirana.deleteTransaction(id);
      if (selectedParty) {
        const data = await hrService.kirana.getPartyDetails(selectedParty.party.id);
        setSelectedParty(data);
      }
      fetchParties();
      fetchSummary();
    } catch {}
    setModal(null);
  };

  const handleCashRowClick = (entry) => {
    if (!isMobile) return;
    setSelectedCash(entry);
    if (!cashAttachments[entry.id]) loadCashAttachments(entry.id);
  };

  const handleReportRowClick = (r) => {
    if (!isMobile) return;
    setSelectedReport(r);
  };

  // Column definitions
  const partyColumns = [
    { key: 'name', label: 'Party', render: (v, p) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">{p.name?.charAt(0)?.toUpperCase()}</div>
        <span className="font-medium">{v}</span>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '—' },
    { key: 'balance', label: 'Balance', render: (_, p) => (
      <span className={`font-semibold ${p.balance <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${p.balance <= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {p.balance <= 0 ? `You will get ${formatINR(Math.abs(p.balance))}` : `You will give ${formatINR(p.balance)}`}
        </span>
      </span>
    )},
    { key: 'actions', label: 'Actions', render: (_, p) => (
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={() => openEditParty(p)} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={() => setModal({ action: 'deleteParty', id: p.id, name: p.name })} className="btn-ghost !py-1.5 !px-2.5 text-xs !text-red-500 hover:!bg-red-50" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    )},
  ];

  const cashbookColumns = [
    { key: 'entry_date', label: 'Date', render: (v) => v ? v.split('T')[0] : '-' },
    { key: 'type', label: 'Type', render: (v) => <span className={v === 'IN' ? 'badge-success' : 'badge-danger'}>{v}</span> },
    { key: 'amount', label: 'Amount', render: (v, e) => (
      <span className={`font-semibold ${e.type === 'IN' ? 'text-emerald-600' : 'text-red-500'}`}>
        {e.type === 'IN' ? '+' : '-'}{formatINR(v)}
      </span>
    )},
    { key: 'note', label: 'Note', render: (v) => <span className="max-w-[200px] truncate inline-block">{v || '—'}</span> },
    { key: 'attachments', label: 'Attachments', render: (_, e) => (
      <div className="flex items-center gap-1 flex-wrap" onClick={ev => ev.stopPropagation()}>
        {(cashAttachments[e.id] || []).map(att => (
          <span key={att.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5">
            <a href={`${import.meta.env.VITE_API_BASE_URL}/uploads/${att.stored_name}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate max-w-[80px]">{att.original_name}</a>
            <button onClick={async () => { await hrService.deleteAttachment(att.id); loadCashAttachments(e.id); }} className="text-red-400 hover:text-red-600">&times;</button>
          </span>
        ))}
        <button onClick={(ev) => { ev.stopPropagation(); const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.onchange = async (ev2) => { await hrService.uploadFiles('kirana_cashbook', e.id, Array.from(ev2.target.files), () => {}); loadCashAttachments(e.id); }; inp.click(); }} className="btn-ghost !py-1 !px-2 text-xs font-medium">+File</button>
      </div>
    )},
    { key: 'actions', label: 'Actions', render: (_, e) => (
      <div className="flex gap-1.5">
        <button onClick={(ev) => { ev.stopPropagation(); openEditCash(e); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={(ev) => { ev.stopPropagation(); setModal({ action: 'deleteCash', id: e.id }); }} className="btn-ghost !py-1.5 !px-2.5 text-xs !text-red-500 hover:!bg-red-50" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    )},
  ];

  // Reports columns (dynamic)
  const partyReportColumns = [
    { key: 'type', label: 'Type', render: (v) => <span className="capitalize">{v}</span> },
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '-' },
    { key: 'totalReceived', label: 'Total Received', render: (v) => <span className="text-green-600">{formatINR(v || 0)}</span> },
    { key: 'totalGiven', label: 'Total Given', render: (v) => <span className="text-orange-600">{formatINR(v || 0)}</span> },
    { key: 'balance', label: 'Balance', render: (v, r) => (
      <span className={`font-bold ${(r.balance || 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatINR(Math.abs(v || 0))}
      </span>
    )},
  ];

  const cashReportColumns = [
    { key: 'entry_date', label: 'Date', render: (v) => v ? v.split('T')[0] : '-' },
    { key: 'type', label: 'Type', render: (v) => <span className={v === 'IN' ? 'badge-success' : 'badge-danger'}>{v}</span> },
    { key: 'amount', label: 'Amount', render: (v, r) => (
      <span className={`font-semibold ${r.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
        {r.type === 'IN' ? '+' : '-'}{formatINR(v)}
      </span>
    )},
    { key: 'note', label: 'Note', className: 'whitespace-normal', render: (v) => v || '-' },
  ];

  // Render party detail sidebar/modal
  const renderDetail = () => {
    if (!detail) return null;
    const { party, transactions, totalReceived, totalGiven, balance } = detail;
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30" onClick={() => setDetail(null)}>
        <div className="bg-white w-full max-w-xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{party.name}</h3>
              <p className="text-sm text-gray-500">{formatPhone(party.phone) || 'No phone'} &middot; {party.address || 'No address'}</p>
            </div>
            <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="stat-card text-center">
                <p className="text-xs text-gray-500">Total Given</p>
                <p className="text-lg font-bold text-orange-600">{formatINR(totalGiven)}</p>
              </div>
              <div className="stat-card text-center">
                <p className="text-xs text-gray-500">Total Received</p>
                <p className="text-lg font-bold text-green-600">{formatINR(totalReceived)}</p>
              </div>
              <div className="stat-card text-center">
                <p className="text-xs text-gray-500">Balance</p>
                <p className={`text-lg font-bold ${balance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {balance <= 0 ? `You will get ${formatINR(Math.abs(balance))}` : `You will give ${formatINR(balance)}`}
                </p>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4 className="font-semibold text-gray-900">Add Transaction</h4></div>
              <form onSubmit={handleAddTx} className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value })} className="input-field" required>
                      <option value="given">Given</option>
                      <option value="received">Received</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (Rs.)</label>
                    <input type="number" min="0.01" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <input type="date" value={txForm.entryDate} onChange={e => setTxForm({ ...txForm, entryDate: e.target.value })} className="input-field" required />
                  </div>
                </div>
                <div>
                  <textarea value={txForm.note} onChange={e => setTxForm({ ...txForm, note: e.target.value })} className="input-field" rows={2} placeholder="Note (optional)" />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add Transaction'}</button>
                </div>
              </form>
            </div>

            <div className="card">
              <div className="card-header"><h4 className="font-semibold text-gray-900">Transaction History</h4></div>
              <div className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400 text-center">No transactions</p>
                ) : (
                  transactions.map(tx => (
                    <div key={tx.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${tx.type === 'received' ? 'text-green-600' : 'text-orange-600'}`}>
                          {tx.type === 'received' ? 'Received' : 'Given'} &middot; {formatINR(tx.amount)}
                        </p>
                        <p className="text-xs text-gray-400">{tx.entry_date ? tx.entry_date.split('T')[0] : ''} {tx.note ? `- ${tx.note}` : ''}</p>
                      </div>
                      <button onClick={() => setModal({ action: 'deleteTx', id: tx.id })} className="btn-ghost !py-1 !px-1.5 text-xs !text-red-400 hover:!text-red-600 hover:!bg-red-50" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ledgerIcons = {
    get: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    give: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    report: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  };

  // Tab content: Buyers / Sellers
  const renderDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">{ledgerIcons.get}</div>
          <div>
            <p className="text-sm text-gray-500">You will get</p>
            <p className="text-2xl font-bold text-emerald-600">{formatINR(summary.youWillGet)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">{ledgerIcons.give}</div>
          <div>
            <p className="text-sm text-gray-500">You will give</p>
            <p className="text-2xl font-bold text-red-500">{formatINR(summary.youWillGive)}</p>
          </div>
        </div>
        <button onClick={() => navigate('/admin/ledger/reports')} className="stat-card flex items-center gap-4 text-left w-full cursor-pointer group">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center text-white shrink-0 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-200">{ledgerIcons.report}</div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">View Report</p>
            <p className="text-lg font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform duration-200">Reports &rarr;</p>
          </div>
        </button>
      </div>

      <div className="card">
        <div className="card-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-2">
            <button onClick={() => setPartyType('buyer')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${partyType === 'buyer' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Buyers</button>
            <button onClick={() => setPartyType('seller')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${partyType === 'seller' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Sellers</button>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input type="text" placeholder={`Search ${partyType}...`} value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 max-w-[200px]" />
            </div>
            <button onClick={() => { setEditingParty(null); setPartyForm({ name: '', phone: '', address: '', amount: '', direction: 'to_receive', entryDate: new Date().toISOString().split('T')[0], note: '' }); setShowPartyForm(true); }} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add
            </button>
          </div>
        </div>

        <ResponsiveTable
          columns={partyColumns}
          data={parties}
          keyField="id"
          onRowClick={handlePartyRowClick}
          mobilePrimary="name"
          mobileSecondary="phone"
          emptyMessage={<><p className="text-base font-medium mb-1">No {partyType}s found</p><p className="text-sm">Click &ldquo;Add&rdquo; to create your first {partyType}.</p></>}
        />
      </div>

      {showPartyForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowPartyForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingParty ? 'Edit' : 'Add'} {partyForm.partyType === 'buyer' ? 'Buyer' : partyForm.partyType === 'seller' ? 'Seller' : 'Party'}</h3>
              <button onClick={() => setShowPartyForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddParty} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party Type</label>
                  <select value={partyForm.partyType || partyType} onChange={e => setPartyForm({ ...partyForm, partyType: e.target.value })} className="input-field" required>
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={partyForm.name} onChange={e => setPartyForm({ ...partyForm, name: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
                  <input type="number" min="0" step="0.01" value={partyForm.amount} onChange={e => setPartyForm({ ...partyForm, amount: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                  <select value={partyForm.direction} onChange={e => setPartyForm({ ...partyForm, direction: e.target.value })} className="input-field">
                    <option value="to_receive">To Receive</option>
                    <option value="to_give">To Give</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={partyForm.entryDate} onChange={e => setPartyForm({ ...partyForm, entryDate: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={partyForm.phone} onChange={e => setPartyForm({ ...partyForm, phone: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea value={partyForm.address} onChange={e => setPartyForm({ ...partyForm, address: e.target.value })} className="input-field" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input type="text" value={partyForm.note} onChange={e => setPartyForm({ ...partyForm, note: e.target.value })} className="input-field" placeholder="Optional note for the transaction" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPartyForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isMobile && renderDetail()}
    </div>
  );

  // Tab content: Cashbook
  const renderCashbook = () => {
    const cashIcons = {
      in: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      out: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
      balance: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    };
    return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Cashbook</h3>
        <button onClick={() => { setEditingCash(null); setCashForm({ type: 'IN', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] }); setCashUploadFiles([]); setShowCashForm(true); }} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Entry
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">{cashIcons.in}</div>
          <div>
            <p className="text-sm text-gray-500">Total IN</p>
            <p className="text-2xl font-bold text-emerald-600">{formatINR(cashSummary.totalIn)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">{cashIcons.out}</div>
          <div>
            <p className="text-sm text-gray-500">Total OUT</p>
            <p className="text-2xl font-bold text-red-500">{formatINR(cashSummary.totalOut)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cashSummary.balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>{cashIcons.balance}</div>
          <div>
            <p className="text-sm text-gray-500">Balance</p>
            <p className={`text-2xl font-bold ${cashSummary.balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatINR(Math.abs(cashSummary.balance))}</p>
          </div>
        </div>
      </div>

      <ResponsiveTable
        columns={cashbookColumns}
        data={cashEntries}
        keyField="id"
        onRowClick={handleCashRowClick}
        mobilePrimary="amount"
        mobileSecondary="amount"
        emptyMessage={<><p className="text-base font-medium mb-1">No entries found</p><p className="text-sm">Click &ldquo;Add Entry&rdquo; to record your first cash transaction.</p></>}
        header={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500">Filter by date:</span>
            <input type="date" value={cashStart} onChange={e => setCashStart(e.target.value)} className="input-field max-w-[150px]" />
            <span className="text-gray-400">—</span>
            <input type="date" value={cashEnd} onChange={e => setCashEnd(e.target.value)} className="input-field max-w-[150px]" />
            {(cashStart || cashEnd) && (
              <button onClick={() => { setCashStart(''); setCashEnd(''); }} className="btn-ghost !py-1.5 !px-2.5 text-xs">Clear</button>
            )}
          </div>
        }
      />

      {showCashForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => { setShowCashForm(false); setEditingCash(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold">{editingCash ? 'Edit Cash Entry' : 'Add Cash Entry'}</h3></div>
            <form onSubmit={handleAddCash} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={cashForm.type} onChange={e => setCashForm({ ...cashForm, type: e.target.value })} className="input-field"><option value="IN">IN</option><option value="OUT">OUT</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount</label><input type="number" min="0.01" step="0.01" value={cashForm.amount} onChange={e => setCashForm({ ...cashForm, amount: e.target.value })} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={cashForm.entryDate} onChange={e => setCashForm({ ...cashForm, entryDate: e.target.value })} className="input-field" required /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label><textarea value={cashForm.note} onChange={e => setCashForm({ ...cashForm, note: e.target.value })} className="input-field" rows={2} /></div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                <input type="file" multiple onChange={e => setCashUploadFiles(Array.from(e.target.files))} className="input-field" />
                {cashUploadFiles.length > 0 && <p className="text-xs text-gray-500 mt-1">{cashUploadFiles.length} file(s) selected</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowCashForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
  };

  // Tab content: Reports
  const [reportTab, setReportTab] = useState('parties');
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDownloading, setReportDownloading] = useState('');
  const [reportPeriod, setReportPeriod] = useState('this_month');
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [reportEntryType, setReportEntryType] = useState('');
  const [reportPartyType, setReportPartyType] = useState('');

  const fmtDate = (d) => d.toISOString().split('T')[0];

  const handleReportPeriod = (value) => {
    setReportPeriod(value);
    if (!value) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (value) {
      case 'this_year':
        setReportStart(`${y}-01-01`);
        setReportEnd(`${y}-12-31`);
        break;
      case 'this_quarter': {
        const qs = Math.floor(m / 3) * 3;
        const qe = qs + 2;
        const ed = new Date(y, qe + 1, 0);
        setReportStart(`${y}-${String(qs + 1).padStart(2, '0')}-01`);
        setReportEnd(fmtDate(ed));
        break;
      }
      case 'this_month': {
        const ed = new Date(y, m + 1, 0);
        setReportStart(`${y}-${String(m + 1).padStart(2, '0')}-01`);
        setReportEnd(fmtDate(ed));
        break;
      }
      case 'last_month': {
        const sd = new Date(y, m - 1, 1);
        const ed = new Date(y, m, 0);
        setReportStart(fmtDate(sd));
        setReportEnd(fmtDate(ed));
        break;
      }
      case 'yesterday': {
        const yd = new Date(now);
        yd.setDate(yd.getDate() - 1);
        setReportStart(fmtDate(yd));
        setReportEnd(fmtDate(yd));
        break;
      }
    }
  };

  useEffect(() => {
    handleReportPeriod('this_month');
  }, []);

  const reportParams = {
    type: reportTab === 'parties' ? 'kirana_party' : 'kirana_cashbook',
    startDate: reportStart || undefined,
    endDate: reportEnd || undefined,
    entryType: reportEntryType || undefined,
    partyType: reportPartyType || undefined,
  };

  useEffect(() => {
    if (tab !== 'reports') return;
    setReportLoading(true);
    hrService.getReportData(reportParams).then(setReportData).catch(() => {}).finally(() => setReportLoading(false));
  }, [tab, reportTab, reportStart, reportEnd, reportEntryType, reportPartyType]);

  const handleReportDownload = async (fmt) => {
    setReportDownloading(fmt);
    try {
      if (fmt === 'pdf') await hrService.kirana.downloadReportPDF(reportParams.type, reportParams);
      else await hrService.kirana.downloadReportExcel(reportParams.type, reportParams);
    } catch {}
    setReportDownloading('');
  };

  const renderReports = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button onClick={() => setReportTab('parties')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportTab === 'parties' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Parties</button>
          <button onClick={() => setReportTab('cashbook')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${reportTab === 'cashbook' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Cashbook</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleReportDownload('pdf')} disabled={!!reportDownloading} className="btn-primary text-sm">{reportDownloading === 'pdf' ? 'Generating...' : 'Download PDF'}</button>
          <button onClick={() => handleReportDownload('excel')} disabled={!!reportDownloading} className="btn-secondary text-sm">{reportDownloading === 'excel' ? 'Generating...' : 'Download Excel'}</button>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-2 text-sm p-3">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-gray-500 shrink-0">Period:</span>
            <select value={reportPeriod} onChange={e => handleReportPeriod(e.target.value)} className="input-field min-w-0 flex-1 sm:max-w-[150px]">
              <option value="">Custom</option>
              <option value="this_year">This Year</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="yesterday">Yesterday</option>
            </select>
          </div>
          <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap">
            <span className="text-gray-500 shrink-0">From:</span>
            <input type="date" value={reportStart} onChange={e => { setReportPeriod(''); setReportStart(e.target.value); }} className="input-field min-w-0 flex-1 sm:max-w-[150px]" />
            <span className="text-gray-500 shrink-0">To:</span>
            <input type="date" value={reportEnd} onChange={e => { setReportPeriod(''); setReportEnd(e.target.value); }} className="input-field min-w-0 flex-1 sm:max-w-[150px]" />
            {(reportStart || reportEnd || (reportTab === 'parties' ? reportPartyType : reportEntryType)) && (
              <button onClick={() => { handleReportPeriod('this_month'); setReportEntryType(''); setReportPartyType(''); }} className="text-xs text-gray-500 hover:text-gray-700 underline shrink-0 whitespace-nowrap">Clear</button>
            )}
          </div>
          {reportTab === 'parties' ? (
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-gray-500 shrink-0 hidden sm:inline">Type:</span>
              <select value={reportPartyType} onChange={e => setReportPartyType(e.target.value)} className="input-field min-w-0 flex-1 sm:max-w-[130px]">
                <option value="">All Parties</option>
                <option value="buyer">Buyers</option>
                <option value="seller">Sellers</option>
              </select>
            </div>
          ) : (
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-gray-500 shrink-0 hidden sm:inline">Type:</span>
              <select value={reportEntryType} onChange={e => setReportEntryType(e.target.value)} className="input-field min-w-0 flex-1 sm:max-w-[130px]">
                <option value="">All Types</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <ResponsiveTable
        columns={reportTab === 'parties' ? partyReportColumns : cashReportColumns}
        data={reportData}
        keyField="id"
        onRowClick={handleReportRowClick}
        mobilePrimary={reportTab === 'parties' ? 'name' : 'amount'}
        mobileSecondary={reportTab === 'parties' ? 'balance' : 'entry_date'}
        loading={reportLoading}
        emptyMessage="No data found"
      />
    </div>
  );

  return (
    <div className="space-y-6">

      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      <div className="border-b border-gray-200">
        <div className="flex -mb-px">
          {INNER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { navigate(`/admin/ledger/${t.key}`); if (t.key === 'buyers' || t.key === 'sellers') setPartyType(t.key === 'buyers' ? 'buyer' : 'seller'); }}
              className={`px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-1 sm:flex-none ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'buyers' || tab === 'sellers' ? renderDashboard() : null}
      {tab === 'cashbook' && renderCashbook()}
      {tab === 'reports' && renderReports()}

      {/* Mobile BottomSheets */}
      {isMobile && selectedParty && (
        <BottomSheet open={true} onClose={() => setSelectedParty(null)} title={selectedParty.party.name}>
          <p className="text-sm text-gray-500">{formatPhone(selectedParty.party.phone) || 'No phone'} &middot; {selectedParty.party.address || 'No address'}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="card text-center p-2">
              <p className="text-xs text-gray-500">Total Given</p>
              <p className="text-sm font-bold text-orange-600">{formatINR(selectedParty.totalGiven)}</p>
            </div>
            <div className="card text-center p-2">
              <p className="text-xs text-gray-500">Total Received</p>
              <p className="text-sm font-bold text-green-600">{formatINR(selectedParty.totalReceived)}</p>
            </div>
            <div className="card text-center p-2">
              <p className="text-xs text-gray-500">Balance</p>
              <p className={`text-sm font-bold ${selectedParty.balance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {selectedParty.balance <= 0 ? `You will get ${formatINR(Math.abs(selectedParty.balance))}` : `You will give ${formatINR(selectedParty.balance)}`}
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h4 className="font-semibold text-gray-900">Add Transaction</h4></div>
            <form onSubmit={handleMobileAddTx} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={mobileTxForm.type} onChange={e => setMobileTxForm({ ...mobileTxForm, type: e.target.value })} className="input-field text-sm" required>
                    <option value="given">Given</option>
                    <option value="received">Received</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                  <input type="number" min="0.01" step="0.01" value={mobileTxForm.amount} onChange={e => setMobileTxForm({ ...mobileTxForm, amount: e.target.value })} className="input-field text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={mobileTxForm.entryDate} onChange={e => setMobileTxForm({ ...mobileTxForm, entryDate: e.target.value })} className="input-field text-sm" required />
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={saving} className="btn-primary text-sm w-full">{saving ? '...' : 'Add'}</button>
                </div>
              </div>
              <div>
                <input type="text" value={mobileTxForm.note} onChange={e => setMobileTxForm({ ...mobileTxForm, note: e.target.value })} className="input-field text-sm" placeholder="Note (optional)" />
              </div>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><h4 className="font-semibold text-gray-900">Transaction History</h4></div>
            <div className="divide-y divide-gray-100">
              {(selectedParty.transactions || []).length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No transactions</p>
              ) : (
                selectedParty.transactions.map(tx => (
                  <div key={tx.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${tx.type === 'received' ? 'text-green-600' : 'text-orange-600'}`}>
                        {tx.type === 'received' ? 'Received' : 'Given'} &middot; {formatINR(tx.amount)}
                      </p>
                      <p className="text-xs text-gray-400">{tx.entry_date ? tx.entry_date.split('T')[0] : ''} {tx.note ? `- ${tx.note}` : ''}</p>
                    </div>
                    <button onClick={() => setModal({ action: 'mobileDeleteTx', id: tx.id })} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </BottomSheet>
      )}

      {isMobile && selectedCash && (
        <BottomSheet
          open={true}
          onClose={() => setSelectedCash(null)}
          title="Entry Details"
          actions={[
            <button key="edit" onClick={() => { setSelectedCash(null); openEditCash(selectedCash); }} className="btn-primary flex-1">Edit</button>,
            <button key="delete" onClick={() => { setSelectedCash(null); setModal({ action: 'deleteCash', id: selectedCash.id }); }} className="btn-secondary flex-1 !text-red-600 !border-red-200">Delete</button>,
          ]}
        >
          <DetailRow label="Date" value={selectedCash.entry_date ? selectedCash.entry_date.split('T')[0] : '-'} />
          <DetailRow label="Type" value={selectedCash.type} />
          <DetailRow label="Amount" value={`${selectedCash.type === 'IN' ? '+' : '-'}${formatINR(selectedCash.amount)}`} />
          <DetailRow label="Note" value={selectedCash.note || '—'} />
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Attachments</h4>
            <div className="flex items-center gap-2 flex-wrap">
              {(cashAttachments[selectedCash.id] || []).map(att => (
                <span key={att.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-2 py-1">
                  <a href={`${import.meta.env.VITE_API_BASE_URL}/uploads/${att.stored_name}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{att.original_name}</a>
                  <button onClick={async () => { await hrService.deleteAttachment(att.id); loadCashAttachments(selectedCash.id); }} className="text-red-400 hover:text-red-600 ml-1">&times;</button>
                </span>
              ))}
              <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.onchange = async (ev) => { await hrService.uploadFiles('kirana_cashbook', selectedCash.id, Array.from(ev.target.files), () => {}); loadCashAttachments(selectedCash.id); }; inp.click(); }} className="btn-ghost !py-1 !px-2 text-xs font-medium">+File</button>
            </div>
          </div>
        </BottomSheet>
      )}

      {isMobile && selectedReport && (
        <BottomSheet open={true} onClose={() => setSelectedReport(null)} title="Details">
          {reportTab === 'parties' ? (
            <>
              <DetailRow label="Type" value={selectedReport.type} />
              <DetailRow label="Name" value={selectedReport.name} />
              <DetailRow label="Phone" value={formatPhone(selectedReport.phone)} />
              <DetailRow label="Total Received" value={formatINR(selectedReport.totalReceived || 0)} />
              <DetailRow label="Total Given" value={formatINR(selectedReport.totalGiven || 0)} />
              <DetailRow label="Balance" value={formatINR(Math.abs(selectedReport.balance || 0))} />
            </>
          ) : (
            <>
              <DetailRow label="Date" value={selectedReport.entry_date ? selectedReport.entry_date.split('T')[0] : '-'} />
              <DetailRow label="Type" value={selectedReport.type} />
              <DetailRow label="Amount" value={`${selectedReport.type === 'IN' ? '+' : '-'}${formatINR(selectedReport.amount)}`} />
              <DetailRow label="Note" value={selectedReport.note || '—'} />
            </>
          )}
        </BottomSheet>
      )}

      {modal && (
        <ConfirmModal
          title={modal.action === 'deleteParty' ? `Delete ${modal.name}?` : undefined}
          message={modal.action === 'deleteParty' ? `Permanently delete ${modal.name}? All transactions will be removed.` : 'Are you sure you want to delete this?'}
          onConfirm={() => {
            if (modal.action === 'deleteTx') handleDeleteTx(modal.id);
            else if (modal.action === 'mobileDeleteTx') handleMobileDeleteTx(modal.id);
            else if (modal.action === 'deleteParty') hrService.kirana.deleteParty(modal.id).then(() => { fetchParties(); fetchSummary(); setModal(null); });
            else if (modal.action === 'deleteCash') handleDeleteCash(modal.id);
            else setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default KiranaStore;
