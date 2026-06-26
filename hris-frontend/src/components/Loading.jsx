const Loading = ({ text = 'Loading...', className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-12 gap-3 text-gray-400 ${className}`}>
    <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-80" style={{ color: 'var(--primary-600, #0B3C5D)' }} />
    </svg>
    {text && <span className="text-sm font-medium">{text}</span>}
  </div>
);

export default Loading;
