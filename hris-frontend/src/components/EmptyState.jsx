export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="text-4xl mb-3 opacity-60">{icon}</div>
      {title && <p className="text-sm font-medium text-gray-700">{title}</p>}
      {message && <p className="text-sm text-gray-400 mt-1 max-w-xs">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
