import { useState, useEffect } from 'react';
import api from '../services/api';

export default function PromoBanner({ onApply }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/core/retention/campaigns')
      .then(res => setCampaigns(res.data.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || campaigns.length === 0) return null;

  return (
    <div className="space-y-3">
      {campaigns.map(c => (
        <div key={c.id} className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-amber-900">{c.name}</h4>
              {c.description && <p className="text-xs text-amber-700 mt-0.5">{c.description}</p>}
              <div className="flex gap-2 mt-2">
                {c.discount_pct && (
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    {c.discount_pct}% OFF
                  </span>
                )}
                {c.discount_months && (
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
                    {c.discount_months} Month{c.discount_months > 1 ? 's' : ''} Free
                  </span>
                )}
                {c.code && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono">
                    {c.code}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-amber-500 shrink-0">
              {Math.ceil((new Date(c.ends_at) - new Date()) / 86400000)}d left
            </span>
          </div>
          {c.code && (
            <button
              onClick={() => onApply?.(c.code)}
              className="mt-3 text-xs font-medium text-amber-700 hover:text-amber-800 underline"
            >
              Apply promo code &rarr;
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
