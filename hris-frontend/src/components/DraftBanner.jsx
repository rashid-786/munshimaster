export default function DraftBanner({ savedAt, onRestore, onDismiss }) {
  if (!savedAt) return null;

  const diff = Date.now() - savedAt;
  const mins = Math.floor(diff / 60000);
  const label = mins < 60
    ? `${mins} min ago`
    : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-4">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Unsaved draft from <strong>{label}</strong></span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={onRestore}
          className="text-xs font-medium text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-md transition-colors">
          Restore
        </button>
        <button type="button" onClick={onDismiss}
          className="text-xs text-amber-600 hover:text-amber-800">&times;</button>
      </div>
    </div>
  );
}
