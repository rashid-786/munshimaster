import React, { useState } from 'react';
import RunPayroll from './RunPayroll';
import PayrollConsole from './PayrollConsole';

const TABS = [
  { key: 'run', label: 'Run Payroll' },
  { key: 'history', label: 'Payroll History' },
];

const Payroll = () => {
  const [activeTab, setActiveTab] = useState('run');
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'run' ? (
        <RunPayroll onSwitchToHistory={() => { setActiveTab('history'); setHistoryKey(k => k + 1); }} />
      ) : (
        <PayrollConsole key={historyKey} />
      )}
    </div>
  );
};

export default Payroll;
