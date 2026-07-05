export default function DashboardCard({ title, value, subtitle, icon, trend, trendLabel, color = 'indigo', loading, onClick, children }) {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    violet: 'from-violet-500 to-violet-600',
    cyan: 'from-cyan-500 to-cyan-600',
    orange: 'from-orange-500 to-orange-600',
    teal: 'from-teal-500 to-teal-600',
  };
  const dotColors = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', violet: 'bg-violet-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500', teal: 'bg-teal-500' };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-20 bg-gray-200 rounded" />
      </div>
    );
  }

  if (children) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''} transition-all duration-200`} onClick={onClick}>
        {children}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''} transition-all duration-200`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-gray-900 truncate max-w-[180px]">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color] || colors.indigo} flex items-center justify-center text-white shadow-sm shrink-0`}>
            {icon}
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <span className={`font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-gray-400">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
