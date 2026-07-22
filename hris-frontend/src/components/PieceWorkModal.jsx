import React from 'react';
import { formatINR } from '../utils/currency';

export default function PieceWorkModal({ open, onClose, entries, employeeName, actualHours, unitLabel }) {
  if (!open) return null;

  const grouped = {};
  (entries || []).forEach(e => {
    const wt = e.workType || e.work_type || 'Other';
    if (!grouped[wt]) grouped[wt] = { workType: wt, unitLabel: e.unitLabel || e.unit_label || 'pcs', ratePerPiece: e.ratePerPiece || e.rate_per_piece || 0, quantity: 0, calculatedAmount: 0 };
    grouped[wt].quantity += parseFloat(e.quantity || 0);
    grouped[wt].calculatedAmount += parseInt(e.calculatedAmount || e.calculated_amount || 0);
  });
  const rows = Object.values(grouped);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmt = rows.reduce((s, r) => s + r.calculatedAmount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-[480px] max-w-[90vw] mx-4 overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{employeeName}</h3>
            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{actualHours} {unitLabel || 'pcs'}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-3 max-h-[50vh] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">No entries</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-2 py-2 text-gray-500 font-medium">Work Type</th>
                  <th className="text-left px-2 py-2 text-gray-500 font-medium">Unit</th>
                  <th className="text-right px-2 py-2 text-gray-500 font-medium">Rate</th>
                  <th className="text-right px-2 py-2 text-gray-500 font-medium">Qty</th>
                  <th className="text-right px-2 py-2 text-gray-500 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-2 text-gray-800 font-medium truncate max-w-[120px]">{r.workType}</td>
                    <td className="px-2 py-2 text-gray-500">{r.unitLabel}</td>
                    <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">
                      {r.ratePerPiece > 0 ? `₹${(r.ratePerPiece / 100).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-700">{r.quantity}</td>
                    <td className="px-2 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{formatINR(r.calculatedAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td className="px-2 py-2.5 text-left text-gray-700 font-semibold" colSpan={3}>Total</td>
                  <td className="px-2 py-2.5 text-right text-gray-500 font-semibold">{totalQty}</td>
                  <td className="px-2 py-2.5 text-right text-gray-900 font-semibold">{formatINR(totalAmt)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
