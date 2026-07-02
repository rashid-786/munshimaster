import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import Loading from '../../components/Loading';

const LedgerDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [kiranaSummary, setKiranaSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showPartyForm, setShowPartyForm] = useState(false);
  const [partyType, setPartyType] = useState('buyer');
  const [partyForm, setPartyForm] = useState({ name: '', phone: '', address: '', amount: '', direction: 'to_receive', entryDate: new Date().toISOString().split('T')[0], note: '' });

  const [showCashForm, setShowCashForm] = useState(false);
  const [cashForm, setCashForm] = useState({ type: 'IN', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      hrService.getDashboard(),
      hrService.kirana.getSummary({})
    ])
      .then(([d, s]) => { setData(d); setKiranaSummary(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openPartyForm = (type) => {
    setPartyType(type);
    setPartyForm({ name: '', phone: '', address: '', amount: '', direction: 'to_receive', entryDate: new Date().toISOString().split('T')[0], note: '' });
    setShowPartyForm(true);
  };

  const handleAddParty = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrService.kirana.createParty({ type: partyType, ...partyForm });
      setShowPartyForm(false);
      setMessage('');
      navigate(`/admin/ledger/${partyType === 'buyer' ? 'buyers' : 'sellers'}`);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to add.');
    }
    setSaving(false);
  };

  const openCashForm = () => {
    setCashForm({ type: 'IN', amount: '', note: '', entryDate: new Date().toISOString().split('T')[0] });
    setShowCashForm(true);
  };

  const handleAddCash = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await hrService.kirana.createCashEntry(cashForm);
      setShowCashForm(false);
      setMessage('');
      navigate('/admin/ledger/cashbook');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to add.');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loading /></div>;
  if (!data) return null;

  const receivables = kiranaSummary ? kiranaSummary.youWillGet : 0;
  const payables = kiranaSummary ? kiranaSummary.youWillGive : 0;
  const cashBalance = parseInt(data.income || 0) - parseInt(data.expense || 0);

  return (
    <div className="space-y-5 max-w-4xl">

      {message && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{message}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => navigate('/admin/ledger/buyers')} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-indigo-300 transition-all">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Receivables</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatINR(receivables)}</p>
          <p className="text-xs text-gray-400 mt-0.5">What buyers owe you</p>
        </button>
        <button onClick={() => navigate('/admin/ledger/sellers')} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-indigo-300 transition-all">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Payables</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatINR(payables)}</p>
          <p className="text-xs text-gray-400 mt-0.5">What you owe sellers</p>
        </button>
        <button onClick={() => navigate('/admin/ledger/cashbook')} className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-indigo-300 transition-all">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Cash Balance</p>
          <p className={`text-2xl font-bold mt-1 ${cashBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatINR(cashBalance)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Income − Expenses</p>
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
          <button onClick={() => navigate('/admin/ledger/cashbook')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All</button>
        </div>
        <div className="divide-y divide-gray-50">
          {(data.recentTransactions || []).slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{t.party_name || 'Cash Entry'}</p>
                <p className="text-xs text-gray-400">{new Date(t.entry_date).toLocaleDateString()} · {t.note || t.type}</p>
              </div>
              <p className={`text-sm font-semibold shrink-0 ml-3 ${t.type === 'received' ? 'text-emerald-600' : 'text-red-600'}`}>
                {t.type === 'received' ? '+' : '−'}₹{parseInt(t.amount).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
          {(!data.recentTransactions || data.recentTransactions.length === 0) && (
            <div className="text-center py-10 text-sm text-gray-400">
              No entries yet. Record your first transaction in the cashbook.
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => openPartyForm('buyer')} className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-md hover:border-indigo-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">Add Buyer</p>
          </button>
          <button onClick={() => openPartyForm('seller')} className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-md hover:border-indigo-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">Add Seller</p>
          </button>
          <button onClick={() => openCashForm()} className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-md hover:border-indigo-300 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mx-auto mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3.75-3.75h3.375a1.5 1.5 0 010 3h-3.375m0 0a1.5 1.5 0 01-1.5 1.5H9l3.75 5.25M12 3a9 9 0 100 18 9 9 0 000-18z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">Add Entry</p>
          </button>
        </div>
      </div>

      {/* Add Buyer / Add Seller Modal */}
      {showPartyForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowPartyForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add {partyType === 'buyer' ? 'Buyer' : 'Seller'}</h3>
              <button onClick={() => setShowPartyForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddParty} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                <input type="text" value={partyForm.note} onChange={e => setPartyForm({ ...partyForm, note: e.target.value })} className="input-field" placeholder="Optional note" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowPartyForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Cash Entry Modal */}
      {showCashForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={() => setShowCashForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-lg font-semibold">Add Cash Entry</h3></div>
            <form onSubmit={handleAddCash} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><select value={cashForm.type} onChange={e => setCashForm({ ...cashForm, type: e.target.value })} className="input-field"><option value="IN">IN</option><option value="OUT">OUT</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount</label><input type="number" min="0.01" step="0.01" value={cashForm.amount} onChange={e => setCashForm({ ...cashForm, amount: e.target.value })} className="input-field" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={cashForm.entryDate} onChange={e => setCashForm({ ...cashForm, entryDate: e.target.value })} className="input-field" required /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Note</label><textarea value={cashForm.note} onChange={e => setCashForm({ ...cashForm, note: e.target.value })} className="input-field" rows={2} /></div>
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

export default LedgerDashboard;
