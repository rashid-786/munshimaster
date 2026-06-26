import { useState, useMemo, useRef } from 'react';
import useIsMobile from '../hooks/useIsMobile';
import Loading from './Loading';

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
  searchable,
  searchKeys,
  pageSize = 35,
}) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const searchRef = useRef(null);

  const keys = searchKeys || columns.map(c => c.key);
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      keys.some(k => {
        const val = row[k];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, keys]);

  const hasMore = visibleCount < filtered.length;
  const displayData = filtered.slice(0, visibleCount);

  const handleLoadMore = () => setVisibleCount(c => c + pageSize);
  const isPaginated = typeof totalPages === 'number' && totalPages > 1;

  const searchBox = searchable ? (
    <div className="p-3 border-b border-gray-100">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setVisibleCount(pageSize); }}
          placeholder="Search records..."
          className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-[var(--primary-500)] focus:border-[var(--primary-500)] bg-white placeholder:text-gray-400"
        />
        {search && (
          <button onClick={() => { setSearch(''); setVisibleCount(pageSize); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </div>
  ) : null;

  const loadMoreBtn = !isPaginated && hasMore ? (
    <div className="flex justify-center py-4 border-t border-gray-100">
      <button onClick={handleLoadMore} className="btn-secondary-navy text-sm px-6 py-2">
        Load More ({filtered.length - visibleCount} remaining)
      </button>
    </div>
  ) : null;

  const infoBar = !isPaginated && filtered.length > 0 ? (
    <div className="flex items-center justify-between px-6 py-2 border-t border-gray-100 text-xs text-gray-400">
      <span>Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} records{search ? ' (filtered)' : ''}</span>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <div className="space-y-3">
        {header && <div className="card px-4 py-3">{header}</div>}
        {searchBox}
        {loading ? (
          <Loading text="" />
        ) : displayData.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">{emptyMessage}</div>
        ) : (
          displayData.map((row) => {
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
                  <div className="font-medium text-gray-900 text-sm truncate">{primaryValue}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{secondaryValue}</div>
                </div>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            );
          })
        )}
        {!isPaginated && hasMore && (
          <div className="flex justify-center pt-1 pb-2">
            <button onClick={handleLoadMore} className="btn-secondary-navy text-sm px-6 py-2">
              Load More ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
        {!isPaginated && filtered.length > 0 && (
          <div className="text-center text-xs text-gray-400">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} records{search ? ' (filtered)' : ''}
          </div>
        )}
        {isPaginated && totalPages > 1 && (
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
      {searchBox}
      {loading ? (
        <Loading />
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
                {displayData.length === 0 ? (
                  <tr><td colSpan={columns.length} className="text-center text-gray-400 py-8">{emptyMessage}</td></tr>
                ) : (
                  displayData.map((row) => (
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
          {loadMoreBtn}
          {infoBar}
          {isPaginated && totalPages > 1 && (
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
