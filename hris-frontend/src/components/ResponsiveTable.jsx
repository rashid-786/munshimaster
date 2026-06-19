import useIsMobile from '../hooks/useIsMobile';

export default function ResponsiveTable({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  emptyMessage = 'No data found',
  mobilePrimary,
  mobileSecondary,
  renderActions,
  loading,
  total,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  header,
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-3">
        {header && <div className="card px-4 py-3">{header}</div>}
        {loading ? (
          <div className="card p-8 flex items-center justify-center text-gray-400 py-8">
            <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : data.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">{emptyMessage}</div>
        ) : (
          data.map((row) => {
            const primaryField = mobilePrimary || columns[0]?.key;
            const secondaryField = mobileSecondary || columns[1]?.key;

            const primaryCol = columns.find(c => c.key === primaryField);
            const secondaryCol = columns.find(c => c.key === secondaryField);

            const primaryValue = primaryCol?.render
              ? primaryCol.render(row[primaryField], row)
              : row[primaryField] ?? '—';
            const secondaryValue = secondaryCol?.render
              ? secondaryCol.render(row[secondaryField], row)
              : row[secondaryField] ?? '—';

            return (
              <div
                key={row[keyField] ?? JSON.stringify(row)}
                onClick={() => onRowClick?.(row)}
                className="card px-4 py-3.5 flex items-center gap-3 cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick?.(row); } }}
                aria-label={`View details for ${row[primaryField] || 'record'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {primaryValue}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {secondaryValue}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-3">
            <span className="text-sm text-gray-500">{total} total</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={onPrevPage} className="btn-secondary text-xs px-3 py-1">Prev</button>
              <span className="text-sm text-gray-600 self-center">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={onNextPage} className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      {header && <div className="p-4 border-b border-gray-100">{header}</div>}
      {loading ? (
        <div className="flex items-center justify-center text-gray-400 py-8">
          <svg className="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {columns.map((col) => (
                    <th key={col.key} className="table-header">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.length === 0 ? (
                  <tr><td colSpan={columns.length} className="text-center text-gray-400 py-8">{emptyMessage}</td></tr>
                ) : (
                  data.map((row) => (
                    <tr
                      key={row[keyField] ?? JSON.stringify(row)}
                        className={`hover:bg-gray-50${onRowClick ? ' cursor-pointer' : ''}`}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col) => (
                        <td key={col.key} className={`table-cell ${col.className || ''}`} onClick={col.key === 'actions' ? (e) => e.stopPropagation() : undefined}>
                          {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">{total} total</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={onPrevPage} className="btn-secondary text-xs px-3 py-1">Prev</button>
                <span className="text-sm text-gray-600 self-center">Page {page} of {totalPages}</span>
                <button disabled={page >= totalPages} onClick={onNextPage} className="btn-secondary text-xs px-3 py-1">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
