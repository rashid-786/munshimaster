import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../services/hr.service';

const TYPE_ICONS = {
  customer: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  invoice: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  purchase_order: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  employee: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  ledger: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
};

const TYPE_LABELS = {
  customer: 'Customer',
  invoice: 'Invoice',
  purchase_order: 'Purchase Order',
  employee: 'Employee',
  ledger: 'Ledger Entry',
};

export default function SearchBar({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await hrService.globalSearch(query);
        setResults(res.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const handleSelect = (r) => {
    onClose();
    navigate(r.link);
  };

  const grouped = results.reduce((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {});

  const typeOrder = ['customer', 'invoice', 'purchase_order', 'employee', 'ledger'];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-gray-200 overflow-hidden animate-scale-in origin-top">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search customers, invoices, POs, employees, ledger..."
            className="flex-1 border-0 outline-none text-sm bg-transparent placeholder-gray-400"
          />
          {loading && (
            <svg className="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <kbd className="hidden sm:inline-flex text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="p-8 text-center text-sm text-gray-400">No results found</div>
        )}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {typeOrder.map(type => {
              const items = grouped[type];
              if (!items) return null;
              return (
                <div key={type}>
                  <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{TYPE_LABELS[type] || type}</p>
                  {items.map((r, i) => (
                    <button
                      key={`${r.type}-${r.id}-${i}`}
                      onClick={() => handleSelect(r)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors text-left"
                    >
                      <span className="shrink-0 text-gray-400">{TYPE_ICONS[r.type] || null}</span>
                      <span className="truncate font-medium text-gray-700">{r.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {query.length < 2 && (
          <div className="p-8 text-center text-sm text-gray-400">
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
