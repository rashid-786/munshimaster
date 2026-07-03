import { useMemo, useState } from 'react';
import UpgradeModal from './UpgradeModal';

const LEVEL_COLORS = {
  ok: { bar: 'bg-green-500', bg: 'bg-green-100', text: 'text-green-700' },
  warn: { bar: 'bg-amber-500', bg: 'bg-amber-100', text: 'text-amber-700' },
  danger: { bar: 'bg-red-500', bg: 'bg-red-100', text: 'text-red-700' },
  full: { bar: 'bg-red-600', bg: 'bg-red-100', text: 'text-red-800' },
};

function getLevel(current, limit) {
  if (limit === -1) return 'ok';
  const pct = (current / limit) * 100;
  if (pct >= 100) return 'full';
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warn';
  return 'ok';
}

function formatNumber(n) {
  return n?.toLocaleString() ?? '0';
}

export default function UsageCard({ label, current, limit, requiredPlan }) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isUnlimited = limit === -1;
  const level = isUnlimited ? 'ok' : getLevel(current, limit);
  const colors = LEVEL_COLORS[level];
  const pct = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);

  const message = useMemo(() => {
    if (isUnlimited) return null;
    if (current >= limit) return `${label} limit reached. Upgrade to continue adding.`;
    if (level === 'danger') return `Only ${limit - current} ${label.toLowerCase()} remaining this month.`;
    if (level === 'warn') return `You've used ${Math.round(pct)}% of your ${label.toLowerCase()} limit.`;
    return null;
  }, [label, current, limit, isUnlimited, level, pct]);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-semibold text-gray-900">
            {isUnlimited ? (
              <span className="text-gray-400">{formatNumber(current)} / Unlimited</span>
            ) : (
              <>{formatNumber(current)} / {formatNumber(limit)}</>
            )}
          </span>
        </div>

        {!isUnlimited && (
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {message && (
          <p className={`text-xs font-medium mb-3 ${colors.text}`}>{message}</p>
        )}

        {(level === 'danger' || level === 'full') && requiredPlan && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Upgrade to increase {label.toLowerCase()} limit
          </button>
        )}
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        requiredPlan={requiredPlan}
      />
    </>
  );
}
