const base = 'w-4 h-4';
const btn = 'btn-ghost !py-1.5 !px-2.5';
const redBtn = `${btn} !text-red-500 hover:!bg-red-50`;
const warnBtn = `${btn} !text-amber-500 hover:!bg-amber-50`;

export const EditIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export const DeleteIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const ViewIcon = () => (
  <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

export const DeactivateIcon = ({ className = base }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20a8 8 0 0116 0" />
    <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
  </svg>
);

export function ActionEdit({ onClick }) {
  return <button className={btn} title="Edit" onClick={onClick}><EditIcon /></button>;
}

export function ActionDelete({ onClick }) {
  return <button className={redBtn} title="Delete" onClick={onClick}><DeleteIcon /></button>;
}

export function ActionView({ onClick }) {
  return <button className={btn} title="View" onClick={onClick}><ViewIcon /></button>;
}

export function ActionDeactivate({ onClick }) {
  return <button className={warnBtn} title="Deactivate" onClick={onClick}><DeactivateIcon /></button>;
}
