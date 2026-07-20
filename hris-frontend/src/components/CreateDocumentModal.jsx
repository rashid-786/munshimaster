import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TransactionForm from './TransactionForm';

const TYPES = { sales: 'sales_invoice', purchase: 'purchase_invoice' };

export default function CreateDocumentModal({ open, direction = 'sales', onClose }) {
  const navigate = useNavigate();
  const [dir, setDir] = useState(direction);

  useEffect(() => {
    if (open) setDir(direction);
  }, [open, direction]);

  if (!open) return null;
  const type = TYPES[dir];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-3 md:p-6 overflow-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-4 md:my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setDir('sales')}
              className={`px-3 md:px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${dir === 'sales' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sales Invoice
            </button>
            <button
              type="button"
              onClick={() => setDir('purchase')}
              className={`px-3 md:px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${dir === 'purchase' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Purchase Bill
            </button>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">&times;</button>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <TransactionForm
            key={type}
            transactionType={type}
            onClose={onClose}
            onSaved={() => {
              onClose();
              navigate(dir === 'sales' ? '/admin/sales-transactions' : '/admin/purchase-transactions');
            }}
          />
        </div>
      </div>
    </div>
  );
}
