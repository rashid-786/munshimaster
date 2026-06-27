import { useState, useEffect } from 'react';
import api from '../../services/api';
import Loading from '../../components/Loading';

export default function Referrals() {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ totalCredited: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/core/retention/referral/code'),
      api.get('/core/retention/referral/stats'),
    ])
      .then(([codeRes, statsRes]) => {
        setCode(codeRes.data.code);
        setStats(statsRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shareUrl = `${window.location.origin}/register?ref=${code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = async (method) => {
    const text = `Join me on Bahi360 — the all-in-one business management app! Use my referral code: ${code}\n\n${shareUrl}`;
    if (method === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (method === 'email') {
      window.open(`mailto:?subject=${encodeURIComponent('Join me on Bahi360')}&body=${encodeURIComponent(text)}`, '_blank');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loading /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Refer a Friend</h2>
        <p className="text-sm text-gray-500 mt-1">Share your referral code and earn 1 month free for every friend who upgrades.</p>
      </div>

      {/* Referral code card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Your Referral Code</label>
          <div className="mt-1 flex gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-lg font-bold tracking-widest text-center text-indigo-700 select-all">
              {code}
            </div>
            <button
              onClick={handleCopy}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Share Link</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 select-all"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleShare('whatsapp')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share on WhatsApp
          </button>
          <button
            onClick={() => handleShare('email')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Share via Email
          </button>
        </div>
      </div>

      {/* Stats card */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{stats.totalCredited}</p>
          <p className="text-sm text-gray-500 mt-1">Rewards Credited</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-amber-600">{stats.totalPending}</p>
          <p className="text-sm text-gray-500 mt-1">Pending (awaiting upgrade)</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">How it works</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="text-indigo-600 font-bold">1.</span>
            Share your referral code or link with friends.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-600 font-bold">2.</span>
            They sign up and enter your code during registration.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-600 font-bold">3.</span>
            When they upgrade to a paid plan, you both get 1 month free.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-600 font-bold">4.</span>
            Rewards are applied to your next billing cycle automatically.
          </li>
        </ul>
      </div>
    </div>
  );
}
