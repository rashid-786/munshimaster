import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import Loading from '../../components/Loading';
import useIsMobile from '../../hooks/useIsMobile';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'salary',    label: 'Salary' },
  { key: 'hours',     label: 'Working Hours' },
  { key: 'leaves',    label: 'Leaves' },
  { key: 'advances',  label: 'Advances' },
];

const DATE_PRESETS = [
  { label: 'Today',        fn: () => { const n=new Date(); return {start:n,end:n}; } },
  { label: 'Yesterday',    fn: () => { const n=new Date(); n.setDate(n.getDate()-1); return {start:n,end:n}; } },
  { label: 'Current Week', fn: () => { const n=new Date(); const d=n.getDay(); return {start:new Date(n.getFullYear(),n.getMonth(),n.getDate()-d),end:n}; } },
  { label: 'Last Week',    fn: () => { const n=new Date(); const d=n.getDay(); const e=new Date(n.getFullYear(),n.getMonth(),n.getDate()-d-1); e.setDate(e.getDate()-6); return {start:e,end:new Date(n.getFullYear(),n.getMonth(),n.getDate()-d-1)}; } },
  { label: 'Current Month',fn: () => { const n=new Date(); return {start:new Date(n.getFullYear(),n.getMonth(),1),end:n}; } },
  { label: 'Last Month',   fn: () => { const n=new Date(); return {start:new Date(n.getFullYear(),n.getMonth()-1,1),end:new Date(n.getFullYear(),n.getMonth(),0)}; } },
  { label: 'Current Quarter', fn: () => { const n=new Date(); const q=Math.floor(n.getMonth()/3); return {start:new Date(n.getFullYear(),q*3,1),end:n}; } },
  { label: 'Last Quarter', fn: () => { const n=new Date(); const q=Math.floor(n.getMonth()/3)-1; const qs=q*3; return {start:new Date(n.getFullYear(),qs,1),end:new Date(n.getFullYear(),qs+3,0)}; } },
  { label: 'This Year',    fn: () => { const n=new Date(); return {start:new Date(n.getFullYear(),0,1),end:n}; } },
];

function fmt(d) { return d.toISOString().split('T')[0]; }

function KpiCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default function StaffReports() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('Current Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [extraFilter, setExtraFilter] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [summary, setSummary] = useState(null);
  const [salaryData, setSalaryData] = useState([]);
  const [hoursData, setHoursData] = useState([]);
  const [leavesData, setLeavesData] = useState([]);
  const [advancesData, setAdvancesData] = useState([]);
  const [charts, setCharts] = useState(null);

  const salaryTrend = useMemo(() => {
    if (!charts?.salaryTrend) return [];
    return charts.salaryTrend.map(d => ({ ...d, gross: Math.round((d.gross || 0) / 100), total: Math.round((d.total || 0) / 100) }));
  }, [charts]);

  const advanceTrend = useMemo(() => {
    if (!charts?.advanceTrend) return [];
    return charts.advanceTrend.map(d => ({ ...d, total: Math.round((d.total || 0) / 100) }));
  }, [charts]);

  const dateRange = useMemo(() => {
    if (datePreset === 'Custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    const p = DATE_PRESETS.find(d => d.label === datePreset);
    if (p) { const r = p.fn(); return { startDate: fmt(r.start), endDate: fmt(r.end) }; }
    return {};
  }, [datePreset, customStart, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...dateRange, search, ...extraFilter };
      if (tab === 'dashboard') {
        const [s, c] = await Promise.all([
          hrService.getStaffReportSummary(params),
          hrService.getStaffReportCharts(params),
        ]);
        setSummary(s);
        setCharts(c);
      } else if (tab === 'salary') {
        const d = await hrService.getSalaryReport({ ...params, status: params.payStatus, payStatus: undefined });
        setSalaryData(d);
      } else if (tab === 'hours') {
        const d = await hrService.getWorkingHoursReport(params);
        setHoursData(d);
      } else if (tab === 'leaves') {
        const d = await hrService.getLeaveReport(params);
        setLeavesData(d);
      } else if (tab === 'advances') {
        const d = await hrService.getAdvanceReport(params);
        setAdvancesData(d);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [tab, dateRange, search, extraFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = (format) => {
    const params = { ...dateRange, search, ...extraFilter };
    hrService.downloadStaffReport(tab === 'hours' ? 'working-hours' : tab, format, params);
  };

  const handlePresetClick = (label) => {
    setDatePreset(label);
    setCustomStart('');
    setCustomEnd('');
  };

  // Summary (dashboard) columns - no table, just KPI cards
  // Salary columns
  const salaryColumns = useMemo(() => [
    { key: 'name', label: 'Employee', render: (_, r) => <span className="font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'hourlyRate', label: 'Pay Rate', render: (_, r) => <span>₹{(r.hourly_rate / 100).toFixed(2)}/hr</span> },
    { key: 'hours', label: 'Worked', render: (_, r) => <span>{r.total_hours_worked}h</span> },
    { key: 'gross', label: 'Gross', render: (_, r) => <span className="font-medium">{formatINR(r.gross_salary)}</span> },
    { key: 'advance_deduction', label: 'Adv. Ded.', render: (v) => v ? <span className="text-orange-600">{formatINR(v)}</span> : <span>-</span> },
    { key: 'net', label: 'Net', render: (_, r) => <span className="font-semibold text-emerald-600">{formatINR(r.net_salary)}</span> },
    { key: 'status', label: 'Status', render: (v) => {
      if (v === 'paid') return <span className="badge badge-success">Paid</span>;
      return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Due</span>;
    } },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => (
      <button onClick={(e) => { e.stopPropagation(); hrService.downloadPayslipFile(r.id); }}
        className="btn-secondary !py-1 !px-2.5 text-xs" title="Download Payslip">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </button>
    ) },
  ], []);

  const payStatusBadge = (status) => {
    if (status === 'paid') return <span className="badge-success text-xs">Paid</span>;
    if (status === 'due') return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Due</span>;
    return <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">Unbilled</span>;
  };

  const hoursColumns = useMemo(() => [
    { key: 'name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'clockIn', label: 'Check-in', render: (_, r) => r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—' },
    { key: 'clockOut', label: 'Check-out', render: (_, r) => r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—' },
    { key: 'totalHours', label: 'Hours', render: (_, r) => <span className="font-medium">{r.total_hours ? `${r.total_hours}h` : '—'}</span> },
    { key: 'payStatus', label: 'Status', render: (_, r) => payStatusBadge(r.pay_status) },
  ], []);

  const leavesColumns = useMemo(() => [
    { key: 'name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'leave_type', label: 'Leave Type', render: (v) => <span className="badge badge-info">{v || '—'}</span> },
    { key: 'start_date', label: 'Start', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'end_date', label: 'End', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'days', label: 'Days', render: (_, r) => {
      if (!r.start_date) return '—';
      const s = new Date(r.start_date), e = new Date(r.end_date);
      return Math.floor((e - s) / (86400000)) + 1;
    }},
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'approved' ? 'badge-success' : v === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{v}</span> },
  ], []);

  const advancesColumns = useMemo(() => [
    { key: 'name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'amount', label: 'Amount', render: (v) => <span className="font-medium">{formatINR(v)}</span> },
    { key: 'recovered', label: 'Recovered', render: (_, r) => <span>{formatINR((r.amount || 0) - (r.remaining_balance || 0))}</span> },
    { key: 'remaining_balance', label: 'Outstanding', render: (v) => <span className="text-orange-500 font-medium">{formatINR(v)}</span> },
    { key: 'created_at', label: 'Request Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'approved' ? 'badge-success' : v === 'fully_paid' ? 'badge-info' : v === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{v?.replace('_', ' ')}</span> },
  ], []);

  const hasExtraFilters = tab === 'leaves' || tab === 'advances';

  function renderDashboard() {
    if (!summary) return null;
    const cards = [
      { label: 'Total Employees',   value: summary.totalEmployees,      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, color: 'bg-indigo-50 text-indigo-600' },
      { label: 'Total Salary Paid',  value: formatINR(summary.totalSalaryPaid), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-emerald-50 text-emerald-600' },
      { label: 'Salary Pending',     value: formatINR(summary.totalSalaryPending), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-amber-50 text-amber-600' },
      { label: 'Hours Logged',       value: `${summary.totalHoursLogged || 0}h`, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-blue-50 text-blue-600' },
      { label: 'Paid Hours',         value: `${summary.totalPaidHours || 0}h`, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-emerald-50 text-emerald-600' },
      { label: 'Advances Issued',    value: formatINR(summary.totalAdvancesIssued), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, color: 'bg-teal-50 text-teal-600' },
      { label: 'Outstanding Advance', value: formatINR(summary.outstandingBalance), icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, color: 'bg-orange-50 text-orange-500' },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map(c => <KpiCard key={c.label} {...c} />)}
        </div>
        {charts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Salary Trend</h4>
              {salaryTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salaryTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '₹' + (v / 1000).toFixed(1) + 'K'} />
                    <Tooltip formatter={(v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })} />
                    <Bar dataKey="gross" fill="#4f46e5" name="Gross" />
                    <Bar dataKey="total" fill="#10b981" name="Net" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No salary data</p>}
            </div>
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Attendance Trend</h4>
              {charts.attendanceTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="hours" stroke="#4f46e5" name="Hours" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No attendance data</p>}
            </div>
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Leave Distribution</h4>
              {charts.leaveDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts.leaveDistribution} dataKey="count" nameKey="leave_type" cx="50%" cy="50%" outerRadius={70} label={({ leave_type, count }) => `${leave_type}: ${count}`}>
                      {charts.leaveDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No leave data</p>}
            </div>
            <div className="card p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Advances Trend</h4>
              {advanceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={advanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '₹' + (v / 1000).toFixed(1) + 'K'} />
                    <Tooltip formatter={(v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })} />
                    <Bar dataKey="total" fill="#f59e0b" name="Advances" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No advance data</p>}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderTable(data, columns) {
    return (
      <ResponsiveTable
        columns={columns}
        data={data}
        keyField="id"
        searchKeys={['first_name', 'last_name', 'email']}
        mobilePrimary="name"
        searchable={false}
        onRowClick={(r) => setSelectedRecord(r)}
        emptyMessage="No records found for the selected period."
        loading={loading}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-4 shrink-0">&times;</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setExtraFilter({}); setSearchParams({ tab: t.key }); }}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date:</span>
          <select value={datePreset === 'Custom' ? '' : datePreset} onChange={e => handlePresetClick(e.target.value)}
            className="input-field max-w-[200px] text-sm">
            <option value="" disabled>Select preset</option>
            {DATE_PRESETS.map(p => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
          <button onClick={() => { setDatePreset('Custom'); setCustomStart(''); setCustomEnd(''); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap border ${
              datePreset === 'Custom'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 border-gray-300'
            }`}>
            <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Custom Range
          </button>
          {datePreset !== 'Custom' && dateRange.startDate && dateRange.endDate && (
            <span className="text-sm text-gray-500 ml-1">
              {new Date(dateRange.startDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}
              {' — '}
              {new Date(dateRange.endDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
            </span>
          )}
        </div>
        {datePreset === 'Custom' && (
          <div className="flex flex-wrap items-center gap-3 pl-1 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">From</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-field text-sm" />
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">To</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-field text-sm" />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {tab !== 'dashboard' && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-sm" />
          </div>
          )}
          {(tab === 'salary' || tab === 'hours') && (
            <select value={extraFilter.payStatus || ''} onChange={e => setExtraFilter(f => ({ ...f, payStatus: e.target.value || undefined }))} className="input-field max-w-[160px] text-sm">
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
              {tab === 'hours' && <option value="unbilled">Unbilled</option>}
            </select>
          )}
          {tab === 'leaves' && (
            <select value={extraFilter.leaveType || ''} onChange={e => setExtraFilter(f => ({ ...f, leaveType: e.target.value || undefined }))} className="input-field max-w-[160px] text-sm">
              <option value="">All Types</option>
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Unpaid">Unpaid</option>
            </select>
          )}
          {tab === 'leaves' && (
            <select value={extraFilter.status || ''} onChange={e => setExtraFilter(f => ({ ...f, status: e.target.value || undefined }))} className="input-field max-w-[140px] text-sm">
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
          {tab === 'advances' && (
            <select value={extraFilter.status || ''} onChange={e => setExtraFilter(f => ({ ...f, status: e.target.value || undefined }))} className="input-field max-w-[160px] text-sm">
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="fully_paid">Fully Paid</option>
            </select>
          )}
          <div className="flex gap-1.5 ml-auto">
            <button onClick={() => handleExport('pdf')} className="btn-secondary !py-1.5 !px-3 text-xs" title="Export PDF">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline ml-1">PDF</span>
            </button>
            <button onClick={() => handleExport('xlsx')} className="btn-secondary !py-1.5 !px-3 text-xs" title="Export Excel">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="hidden sm:inline ml-1">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {loading && <Loading />}

      {!loading && tab === 'dashboard' && renderDashboard()}
      {!loading && tab === 'salary' && renderTable(salaryData, salaryColumns)}
      {!loading && tab === 'hours' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Hours</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{hoursData.reduce((s, r) => s + parseFloat(r.total_hours || 0), 0).toFixed(1)}h</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Employees</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{new Set(hoursData.map(r => r.employee_id)).size}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date Range</p>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                {hoursData.length > 0 ? `${new Date(hoursData[hoursData.length-1].date).toLocaleDateString('en-IN')} — ${new Date(hoursData[0].date).toLocaleDateString('en-IN')}` : '—'}
              </p>
            </div>
          </div>
          {renderTable(hoursData, hoursColumns)}
        </>
      )}
      {!loading && tab === 'leaves' && renderTable(leavesData, leavesColumns)}
      {!loading && tab === 'advances' && renderTable(advancesData, advancesColumns)}

      {/* Mobile detail sheet */}
      {isMobile && selectedRecord && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`${selectedRecord.first_name || ''} ${selectedRecord.last_name || ''}`}
        >
          <div className="space-y-3">
            {Object.entries(selectedRecord).filter(([k]) => !['id','tenant_id','employee_id'].includes(k)).map(([k, v]) => (
              <DetailRow key={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                value={v != null ? String(v) : '—'} />
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{value}</span>
    </div>
  );
}
