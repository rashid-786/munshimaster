import { useState, useEffect, useRef } from 'react';
import { hrService } from '../services/hr.service';

export default function PartySelector({ partyType, value, onChange, error }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const fn = partyType === 'customer' ? hrService.getCustomers : hrService.getSuppliers;
    fn({ search: query, limit: 20 }).then(r => setResults(r.data || [])).catch(() => {});
  }, [query, partyType]);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const select = (item) => {
    onChange({
      id: item.id,
      name: item.name,
      gstin: item.gstin,
      pan: item.pan,
      address: item.billing_address || item.address || '',
      city: item.billing_city || item.city || '',
      state: item.billing_state || item.state || '',
      country: item.billing_country || 'India',
      postal_code: item.billing_postal_code || item.pincode || '',
    });
    setQuery(item.name);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
        placeholder={`Search ${partyType}...`}
        className={`input-field ${error ? 'border-red-400' : ''}`} autoComplete="off" />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map(item => (
            <button key={item.id} type="button" onClick={() => select(item)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 border-b border-gray-50 last:border-0">
              <span className="font-medium text-gray-900">{item.name}</span>
              {item.gstin && <span className="text-xs text-gray-400 ml-2">{item.gstin}</span>}
              {item.city && <span className="text-xs text-gray-400 ml-1">- {item.city}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
