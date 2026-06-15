import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';

const Profile = () => {
  const [payslips, setPayslips] = useState([]);

  useEffect(() => {
    hrService.getPayrollHistory().then(setPayslips).catch(() => {});
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Payslips</h3>
      </div>
      <div className="p-6">
        {payslips.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No payslips available</p>
        ) : (
          <div className="space-y-3">
            {payslips.map(slip => (
              <div key={slip.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{(slip.pay_period_start || '').split('T')[0]} to {(slip.pay_period_end || '').split('T')[0]}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">${(slip.net_salary / 100).toFixed(2)}</p>
                </div>
                <button onClick={() => hrService.downloadPayslipFile(slip.id)} className="btn-secondary">Download</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
