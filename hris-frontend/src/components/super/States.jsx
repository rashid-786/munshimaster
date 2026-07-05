export function EmptyState({ icon, title, message, action, loading }) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-pulse space-y-3">
          <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto" />
          <div className="h-4 w-48 bg-gray-200 rounded mx-auto" />
          <div className="h-3 w-64 bg-gray-200 rounded mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      {icon ? (
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-gray-400">{icon}</span>
        </div>
      ) : (
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title || 'No data'}</h3>
      {message && <p className="text-xs text-gray-500 max-w-xs mx-auto">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ rows = 3, type = 'table' }) {
  if (type === 'card') {
    return (
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-3 w-1/3 bg-gray-200 rounded mb-3" />
            <div className="h-6 w-1/2 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-1/4 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'spinner') {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-100">
        <div className="h-3 w-48 bg-gray-200 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-3 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-12">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Something went wrong</h3>
      <p className="text-xs text-gray-500 max-w-xs mx-auto mb-4">{message || 'An error occurred while loading data.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
          Try Again
        </button>
      )}
    </div>
  );
}
