const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  trialing: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  expired: 'bg-red-100 text-red-700 border-red-200',
  suspended: 'bg-gray-100 text-gray-600 border-gray-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  free: 'bg-slate-100 text-slate-600 border-slate-200',
  business: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  pro: 'bg-violet-100 text-violet-700 border-violet-200',
};

const STATUS_DOTS = {
  active: 'bg-emerald-500',
  trialing: 'bg-blue-500',
  paid: 'bg-indigo-500',
  expired: 'bg-red-500',
  suspended: 'bg-gray-400',
  inactive: 'bg-gray-300',
};

export function TenantStatusBadge({ status, size = 'sm' }) {
  const key = (status || '').toLowerCase();
  const style = STATUS_STYLES[key] || STATUS_STYLES.inactive;
  const dot = STATUS_DOTS[key];
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${style} ${sizeClass}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}

const PLAN_STYLES = {
  free: 'bg-slate-100 text-slate-700 border-slate-200',
  manage: 'bg-amber-100 text-amber-700 border-amber-200',
  business: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  business_pro: 'bg-violet-100 text-violet-700 border-violet-200',
  pro: 'bg-violet-100 text-violet-700 border-violet-200',
};

export function PlanBadge({ plan, size = 'sm' }) {
  const key = (plan || '').toLowerCase().replace(/\s+/g, '_');
  const style = PLAN_STYLES[key] || 'bg-gray-100 text-gray-600 border-gray-200';
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${style} ${sizeClass}`}>
      {(plan || 'Unknown').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}

export function TrialStatusBadge({ daysLeft, size = 'sm' }) {
  if (daysLeft === null || daysLeft === undefined) return null;
  const isExpired = daysLeft <= 0;
  const isUrgent = daysLeft <= 3;
  const color = isExpired ? 'bg-red-100 text-red-700 border-red-200' : isUrgent ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
  const label = isExpired ? 'Expired' : `${daysLeft}d left`;
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';
  return <span className={`inline-flex items-center rounded-full font-medium border ${color} ${sizeClass}`}>{label}</span>;
}
