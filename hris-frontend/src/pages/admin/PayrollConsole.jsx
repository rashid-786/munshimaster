import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const PayrollConsole = () => {
  const isMobile = useIsMobile();
  const [payPeriod, setPayPeriod] = useState({ startDate: '', endDate: '' });
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [payrun, setPayrun] = useState(null);
  const [selectedPayrun, setSelectedPayrun] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);

  useEffect(() => {
    hrService.getPayrollHistory().then(setHistory).catch(() => {});
  }, []);

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.runPayroll(payPeriod);
      setMessage(res.message);
      setPayrun(res);
      hrService.getPayrollHistory().then(setHistory).catch(() => {});
    } catch (err) {
      setMessage(err.response?.data?.error || 'Payroll run failed.');
    }
  };

  const payrunColumns = [
    { key: 'employeeName', label: 'Employee', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'hourlyRate', label: 'Rate', render: (v) => <>₹{v}/hr</> },
    { key: 'hoursWorked', label: 'Worked', render: (v) => <>{v}h</> },
    { key: 'standardHours', label: 'Std Hrs', render: (v) => <>{v}h</> },
    { key: 'gross', label: 'Gross', render: (v) => formatINR(Math.round(parseFloat(v) * 100)) },
    { key: 'deductions', label: 'Deductions', render: (v) => <span className="text-red-600">{formatINR(Math.round(parseFloat(v) * 100))}</span> },
    { key: 'advanceDeduction', label: 'Adv. Ded.', render: (v) => v && parseFloat(v) > 0 ? <span className="text-orange-600">{formatINR(Math.round(parseFloat(v) * 100))}</span> : <span>-</span> },
    { key: 'net', label: 'Net', render: (v) => <span className="font-bold text-emerald-600">{formatINR(Math.round(parseFloat(v) * 100))}</span> },
  ];

  const historyColumns = [
    { key: 'employee_name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'period', label: 'Period', render: (_, r) => <span className="text-gray-500">{(r.pay_period_start || '').split('T')[0]} to {(r.pay_period_end || '').split('T')[0]}</span> },
    { key: 'hourly_rate', label: 'Rate', render: (v) => <>₹{(v / 100).toFixed(2)}/hr</> },
    { key: 'hours', label: 'Hrs', render: (_, r) => <>{r.total_hours_worked}h / {r.standard_hours}h</> },
    { key: 'gross_salary', label: 'Gross', render: (v) => formatINR(v) },
    { key: 'deductions', label: 'Deductions', render: (v) => <span className="text-red-600">{formatINR(v)}</span> },
    { key: 'advance_deduction', label: 'Adv. Ded.', render: (v) => v ? <span className="text-orange-600">{formatINR(v)}</span> : <span>-</span> },
    { key: 'net_salary', label: 'Net', render: (v) => <span className="font-bold text-emerald-600">{formatINR(v)}</span> },
    { key: 'status', label: 'Status', render: () => <span className="badge-success">Paid</span> },
  ];

  const payrunData = payrun?.runs?.map((r, i) => ({ ...r, _key: String(i) })) || [];

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => { setMessage(''); setPayrun(null); }} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      {payrun && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Results</h3>
          <ResponsiveTable
            columns={payrunColumns}
            data={payrunData}
            keyField="_key"
            mobilePrimary="employeeName"
            mobileSecondary="net"
            onRowClick={(r) => setSelectedPayrun(r)}
            emptyMessage="No results"
          />
        </div>
      )}

      <div className="card max-w-xl">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Run Payroll</h3>
        </div>
        <form onSubmit={handleRunPayroll} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input type="date" value={payPeriod.startDate} onChange={e => setPayPeriod({ ...payPeriod, startDate: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input type="date" value={payPeriod.endDate} onChange={e => setPayPeriod({ ...payPeriod, endDate: e.target.value })} className="input-field" required />
            </div>
          </div>
          <p className="text-xs text-gray-500">Working days (Mon-Fri) are auto-calculated. Hours tracked via attendance determine pay.</p>
          <button type="submit" className="btn-primary">Calculate & Process Payroll</button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll History</h3>
        <ResponsiveTable
          columns={historyColumns}
          data={history}
          keyField="id"
          mobilePrimary="employee_name"
          mobileSecondary="net_salary"
          onRowClick={(r) => setSelectedHistory(r)}
          emptyMessage="No payroll history"
        />
      </div>

      {isMobile && (
        <BottomSheet
          open={!!selectedPayrun}
          onClose={() => setSelectedPayrun(null)}
          title={selectedPayrun?.employeeName || 'Payroll Details'}
          actions={null}
        >
          {selectedPayrun && (
            <div className="space-y-3">
              <DetailRow label="Employee" value={selectedPayrun.employeeName} />
              <DetailRow label="Hourly Rate" value={`₹${selectedPayrun.hourlyRate}/hr`} />
              <DetailRow label="Hours Worked" value={`${selectedPayrun.hoursWorked}h`} />
              <DetailRow label="Standard Hours" value={`${selectedPayrun.standardHours}h`} />
              <DetailRow label="Gross" value={formatINR(Math.round(parseFloat(selectedPayrun.gross) * 100))} />
              <DetailRow label="Deductions">
                <span className="text-red-600">{formatINR(Math.round(parseFloat(selectedPayrun.deductions) * 100))}</span>
              </DetailRow>
              <DetailRow label="Adv. Deduction">
                {selectedPayrun.advanceDeduction && parseFloat(selectedPayrun.advanceDeduction) > 0 ? (
                  <span className="text-orange-600">{formatINR(Math.round(parseFloat(selectedPayrun.advanceDeduction) * 100))}</span>
                ) : '—'}
              </DetailRow>
              <DetailRow label="Net">
                <span className="font-bold text-emerald-600">{formatINR(Math.round(parseFloat(selectedPayrun.net) * 100))}</span>
              </DetailRow>
            </div>
          )}
        </BottomSheet>
      )}

      {isMobile && (
        <BottomSheet
          open={!!selectedHistory}
          onClose={() => setSelectedHistory(null)}
          title={selectedHistory ? `${selectedHistory.first_name} ${selectedHistory.last_name}` : 'Payroll Details'}
          actions={null}
        >
          {selectedHistory && (
            <div className="space-y-3">
              <DetailRow label="Employee" value={`${selectedHistory.first_name} ${selectedHistory.last_name}`} />
              <DetailRow label="Period" value={`${(selectedHistory.pay_period_start || '').split('T')[0]} to ${(selectedHistory.pay_period_end || '').split('T')[0]}`} />
              <DetailRow label="Rate" value={`₹${(selectedHistory.hourly_rate / 100).toFixed(2)}/hr`} />
              <DetailRow label="Hours" value={`${selectedHistory.total_hours_worked}h / ${selectedHistory.standard_hours}h`} />
              <DetailRow label="Gross" value={formatINR(selectedHistory.gross_salary)} />
              <DetailRow label="Deductions">
                <span className="text-red-600">{formatINR(selectedHistory.deductions)}</span>
              </DetailRow>
              <DetailRow label="Adv. Deduction">
                {selectedHistory.advance_deduction ? <span className="text-orange-600">{formatINR(selectedHistory.advance_deduction)}</span> : '—'}
              </DetailRow>
              <DetailRow label="Net">
                <span className="font-bold text-emerald-600">{formatINR(selectedHistory.net_salary)}</span>
              </DetailRow>
              <DetailRow label="Status">
                <span className="badge-success">Paid</span>
              </DetailRow>
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
};

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default PayrollConsole;
