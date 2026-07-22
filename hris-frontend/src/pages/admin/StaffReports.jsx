import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import Loading from '../../components/Loading';
import PieceWorkModal from '../../components/PieceWorkModal';
import useIsMobile from '../../hooks/useIsMobile';
import { useAuth } from '../../context/AuthContext';
import SearchableSelect from '../../components/SearchableSelect';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const today = (() => { const n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'); })();

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'salary',    label: 'Salary' },
  { key: 'hours',     label: 'Working Hours' },
  { key: 'piece-work', label: 'Piece Work' },
  { key: 'leaves',    label: 'Leaves' },
  { key: 'advances',  label: 'Advances' },
];

const DATE_PRESETS = [
  { label: 'Today',        fn: () => { const n=new Date(); return {start:n,end:n}; } },
  { label: 'Yesterday',    fn: () => { const n=new Date(); n.setDate(n.getDate()-1); return {start:n,end:n}; } },
  { label: 'Current Week', fn: () => { const n=new Date(); const d=n.getDay(); return {start:new Date(n.getFullYear(),n.getMonth(),n.getDate()-d),end:n}; } },
  { label: 'Last Week',    fn: () => { const n=new Date(); const d=n.getDay(); const e=new Date(n.getFullYear(),n.getMonth(),n.getDate()-d-1); e.setDate(e.getDate()-6); return {start:e,end:new Date(n.getFullYear(),n.getMonth(),n.getDate()-d-1)}; } },
  { label: 'Current Month',fn: () => { const n=new Date(); return {start:new Date(n.getFullYear(),n.getMonth(),1),end:new Date(n.getFullYear(),n.getMonth()+1,0)}; } },
  { label: 'Last Month',   fn: () => { const n=new Date(); return {start:new Date(n.getFullYear(),n.getMonth()-1,1),end:new Date(n.getFullYear(),n.getMonth(),0)}; } },
  { label: 'Current Quarter', fn: () => { const n=new Date(); const q=Math.floor(n.getMonth()/3); return {start:new Date(n.getFullYear(),q*3,1),end:n}; } },
  { label: 'Last Quarter', fn: () => { const n=new Date(); const q=Math.floor(n.getMonth()/3)-1; const qs=q*3; return {start:new Date(n.getFullYear(),qs,1),end:new Date(n.getFullYear(),qs+3,0)}; } },
  { label: 'This Year',    fn: () => { const n=new Date(); return {start:new Date(n.getFullYear(),0,1),end:n}; } },
];

function fmt(d) { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

const formatMonth = (m) => {
  if (!m) return '';
  const d = new Date(m);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short' });
};

function SumCard({ label, value, subtitle, icon, accent }) {
  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-orange-50 text-orange-600',
    gray: 'bg-gray-100 text-gray-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
  };
  const iconBg = colorMap[accent] || 'bg-gray-100 text-gray-500';
  return (
    <div className="card p-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5 leading-tight tracking-tight">{value}</p>
          {subtitle != null && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconBg} ml-3`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle, accent }) {
  const accentColors = {
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    orange: 'text-orange-500',
    gray: 'text-gray-500',
  };
  const valColor = accentColors[accent] || 'text-gray-900';
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
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
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [datePreset, setDatePreset] = useState('Current Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [extraFilter, setExtraFilter] = useState({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDeactivated, setShowDeactivated] = useState(() => localStorage.getItem('staff_reports_show_deactivated') === 'true');

  const search = useMemo(() => {
    if (!selectedEmployeeId) return '';
    const emp = employees.find(e => e.id === selectedEmployeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : '';
  }, [selectedEmployeeId, employees]);

  const [summary, setSummary] = useState(null);
  const [salaryData, setSalaryData] = useState([]);
  const [hoursData, setHoursData] = useState([]);
  const [leavesData, setLeavesData] = useState([]);
  const [advancesData, setAdvancesData] = useState([]);
  const [pieceWorkData, setPieceWorkData] = useState([]);
  const [charts, setCharts] = useState(null);
  const [pieceModal, setPieceModal] = useState(null);
  const pieceCache = useRef({});

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
      const params = { ...dateRange, search, ...extraFilter, staffStatus: showDeactivated ? 'deactivated' : 'active' };
      if (tab === 'dashboard') {
        const [s, c] = await Promise.all([
          hrService.getStaffReportSummary(params),
          hrService.getStaffReportCharts(params),
        ]);
        setSummary(s);
        setCharts(c);
      } else if (tab === 'salary') {
        const [d, s] = await Promise.all([
          hrService.getSalaryReport({ ...params, status: params.payStatus, payStatus: undefined }),
          hrService.getStaffReportSummary(params),
        ]);
        setSalaryData(d);
        setSummary(s);
      } else if (tab === 'hours') {
        const d = await hrService.getWorkingHoursReport(params);
        setHoursData(d);
      } else if (tab === 'leaves') {
        const d = await hrService.getLeaveReport(params);
        setLeavesData(d);
      } else if (tab === 'advances') {
        const d = await hrService.getAdvanceReport(params);
        setAdvancesData(d);
      } else if (tab === 'piece-work') {
        const d = await hrService.getPieceWorkReport(params);
        setPieceWorkData(d);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, [tab, dateRange, search, extraFilter, showDeactivated]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    localStorage.setItem('staff_reports_show_deactivated', showDeactivated ? 'true' : 'false');
  }, [showDeactivated]);

  useEffect(() => {
    hrService.getEmployees(showDeactivated ? { status: 'deactivated' } : {})
      .then(setEmployees).catch(() => {});
  }, [showDeactivated]);

  const handleExport = (format) => {
    const params = { ...dateRange, search, ...extraFilter, staffStatus: showDeactivated ? 'deactivated' : 'active' };
    const exportTab = tab === 'hours' ? 'working-hours' : tab === 'piece-work' ? 'piece-work' : tab;
    hrService.downloadStaffReport(exportTab, format, params);
  };

  const isFiltered = datePreset !== 'Current Month' || !!customStart || !!customEnd || !!selectedEmployeeId || Object.keys(extraFilter).length > 0;

  const clearFilters = () => {
    setDatePreset('Current Month');
    setCustomStart('');
    setCustomEnd('');
    setShowDatePopup(false);
    setSelectedEmployeeId('');
    setExtraFilter({});
  };

  const handlePresetClick = (label) => {
    setDatePreset(label);
    setCustomStart('');
    setCustomEnd('');
    setShowDatePopup(false);
  };

  const salaryColumns = useMemo(() => [
    { key: 'name', label: 'Employee', render: (_, r) => <span className="font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'rateLabel', label: 'Pay Rate', render: (_, r) => {
      if (r.salary_type === 'piece') return (
        <span
          onClick={async () => {
            const startDate = r.pay_period_start ? r.pay_period_start.split('T')[0] : null;
            const endDate = r.pay_period_end ? r.pay_period_end.split('T')[0] : null;
            const key = r.employee_id + startDate + endDate;
            if (!pieceCache.current[key]) {
              try {
                const entries = await hrService.getPieceWorkEmployeeEntries({ employeeId: r.employee_id, startDate, endDate });
                pieceCache.current[key] = entries;
              } catch { pieceCache.current[key] = []; }
            }
            setPieceModal({ entries: pieceCache.current[key], employeeName: `${r.first_name} ${r.last_name}`, unitLabel: r.piece_unit_label || 'pcs', actualHours: r.total_hours_worked });
          }}
          className="text-indigo-500 hover:text-indigo-700 text-xs font-medium cursor-pointer"
        >View Details</span>
      );
      return <span>₹{(r.hourly_rate / 100).toFixed(2)}/hr</span>;
    } },
    { key: 'hours', label: 'Worked', render: (_, r) => {
      if (r.salary_type === 'piece') return <span>{r.total_hours_worked} {r.piece_unit_label || 'pcs'}</span>;
      return <span>{r.total_hours_worked}h</span>;
    } },
    { key: 'gross', label: 'Gross', render: (_, r) => <span className="font-medium">{formatINR(r.gross_salary)}</span> },
    { key: 'advance_deduction', label: 'Adv. Ded.', render: (v) => v ? <span className="text-orange-600">{formatINR(v)}</span> : <span>-</span> },
    { key: 'net', label: 'Net', render: (_, r) => <span className="font-semibold text-emerald-600">{formatINR(r.net_salary)}</span> },
    { key: 'status', label: 'Status', render: (v) => {
      if (v === 'paid') return <span className="badge badge-success">Paid</span>;
      return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Unpaid</span>;
    } },
    { key: 'actions', label: '', className: 'text-right', render: (_, r) => (
      <button onClick={(e) => { e.stopPropagation(); if (r.id) hrService.downloadPayslipFile(r.id); }}
        disabled={!r.id}
        className="btn-secondary !py-1 !px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed" title={r.id ? 'Download Payslip' : 'Payslip not yet generated'}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </button>
    ) },
  ], []);

  const payStatusBadge = (status) => {
    if (status === 'paid') return <span className="badge-success text-xs">Paid</span>;
    return <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Unpaid</span>;
  };

  const hoursColumns = useMemo(() => [
    { key: 'name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
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

  const aggregatedPieceWork = useMemo(() => {
    const map = {};
    pieceWorkData.forEach(e => {
      const key = e.employee_id + '|' + e.date;
      if (!map[key]) map[key] = { employee_id: e.employee_id, first_name: e.first_name, last_name: e.last_name, date: e.date, totalQty: 0, totalAmount: 0, allPaid: true, workTypeDetails: [] };
      const row = map[key];
      const qty = parseFloat(e.quantity || 0);
      row.totalQty += qty;
      row.totalAmount += parseInt(e.calculated_amount || 0, 10);
      if (!e.is_paid) row.allPaid = false;
      row.workTypeDetails.push(e);
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [pieceWorkData]);

  const pieceWorkColumns = useMemo(() => [
    { key: 'name', label: 'Staff Name', render: (_, r) => <span className="font-medium text-gray-900">{r.first_name} {r.last_name}</span> },
    { key: 'date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'payRate', label: 'Pay Rate', render: (_, r) => (
      <span
        onClick={() => {
          setPieceModal({ entries: r.workTypeDetails, employeeName: `${r.first_name} ${r.last_name}`, unitLabel: 'pcs', actualHours: r.totalQty });
        }}
        className="text-indigo-500 hover:text-indigo-700 text-xs font-medium cursor-pointer"
      >View Details</span>
    ) },
    { key: 'totalQty', label: 'Total Qty', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'totalAmount', label: 'Total Amount', render: (v) => <span className="font-medium">{formatINR(v)}</span> },
    { key: 'status', label: 'Status', render: (_, r) => r.totalQty === 0
      ? <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">Absent</span>
      : r.allPaid
        ? <span className="badge-success text-xs">Paid</span>
        : <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Unpaid</span>
    },
  ], []);

  const pieceWorkDetailFields = [
    { key: 'first_name', label: 'Employee', render: (_, r) => `${r.first_name} ${r.last_name}` },
    { key: 'date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { key: 'work_type', label: 'Work Type', render: (v) => v || '—' },
    { key: 'quantity', label: 'Quantity', render: (v) => String(v || 0) },
    { key: 'unit_label', label: 'Unit', render: (v) => v || '—' },
    { key: 'rate_per_piece', label: 'Rate per Piece', render: (v) => `₹${(v / 100).toFixed(2)}` },
    { key: 'calculated_amount', label: 'Amount', render: (v) => formatINR(v) },
    { key: 'payroll_id', label: 'Payroll Ref', render: (v) => v ? v.substring(0, 8) + '…' : '—' },
  ];

  function renderDashboard() {
    if (!summary) return null;
    const totalDueQty = (summary.totalQtyLogged || 0) - (summary.totalQtyPaid || 0);
    const totalDueHours = summary.totalUnpaidHours || 0;
    const cards = [
      { label: 'Total Staff', value: summary.totalEmployees, subtitle: null, accent: 'indigo', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
      { label: 'Unpaid Amount', value: formatINR(summary.totalSalaryPending), subtitle: `${formatINR(summary.totalSalaryPaid)} paid`, accent: 'amber', icon: <span className="text-base font-bold">₹</span> },
      { label: 'Unpaid Hours', value: `${totalDueHours.toFixed(1)}h`, subtitle: `${(summary.totalPaidHours || 0).toFixed(1)}h paid`, accent: 'amber', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      { label: 'Hours Logged', value: `${(summary.totalHoursLogged || 0).toFixed(1)}h`, subtitle: null, accent: 'sky', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg> },
      { label: 'Unpaid Qty', value: totalDueQty.toFixed(1), subtitle: `${(summary.totalQtyPaid || 0).toFixed(1)} paid`, accent: 'amber', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
      { label: 'Qty Logged', value: (summary.totalQtyLogged || 0).toFixed(1), subtitle: null, accent: 'violet', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg> },
      { label: 'Advance Issued', value: formatINR(summary.totalAdvancesIssued), subtitle: null, accent: 'rose', icon: <span className="text-base font-bold">₹</span> },
      { label: 'Outstanding Adv.', value: formatINR(summary.outstandingBalance), subtitle: null, accent: 'orange', icon: <span className="text-base font-bold">₹</span> },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map(c => <SumCard key={c.label} {...c} />)}
        </div>
        {charts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <h4 className="text-sm font-semibold text-gray-700">Salary Trend</h4>
              </div>
              {salaryTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salaryTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={formatMonth} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '₹' + (v / 1000).toFixed(1) + 'K'} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={formatMonth} formatter={(v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="gross" fill="#4f46e5" name="Gross" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total" fill="#10b981" name="Net" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No salary data</p>}
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h4 className="text-sm font-semibold text-gray-700">Attendance Trend</h4>
              </div>
              {charts.attendanceTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts.attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={formatMonth} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={formatMonth} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="hours" stroke="#4f46e5" name="Hours" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No attendance data</p>}
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h4 className="text-sm font-semibold text-gray-700">Leave Distribution</h4>
              </div>
              {charts.leaveDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts.leaveDistribution} dataKey="count" nameKey="leave_type" cx="50%" cy="50%" outerRadius={70} label={({ leave_type, count }) => `${leave_type}: ${count}`}>
                      {charts.leaveDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-8">No leave data</p>}
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <h4 className="text-sm font-semibold text-gray-700">Advances Trend</h4>
              </div>
              {advanceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={advanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={formatMonth} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '₹' + (v / 1000).toFixed(1) + 'K'} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={formatMonth} formatter={(v) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="total" fill="#f59e0b" name="Advances" radius={[4, 4, 0, 0]} />
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
    <div className="space-y-5 animate-fade-in">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-4 shrink-0">&times;</button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelectedEmployeeId(''); setExtraFilter({}); setSearchParams({ tab: t.key }); }}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors rounded-t-lg ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Employee filter */}
          <div className="min-w-[180px] max-w-[220px] flex-1 sm:flex-none">
            <SearchableSelect
              options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}${(e.salary_type || 'fixed') === 'piece' ? ' 🧩' : ''}` }))}
              value={selectedEmployeeId}
              onChange={(val) => setSelectedEmployeeId(val)}
              placeholder="All employees..."
            />
          </div>

          {/* Status filters (tab-dependent) */}
          {tab === 'salary' && (
            <select value={extraFilter.payStatus || ''} onChange={e => setExtraFilter(f => ({ ...f, payStatus: e.target.value || undefined }))} className="input-field max-w-[120px] text-sm">
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="due">Unpaid</option>
            </select>
          )}
          {(tab === 'hours' || tab === 'piece-work') && (
            <select value={extraFilter.payStatus || ''} onChange={e => setExtraFilter(f => ({ ...f, payStatus: e.target.value || undefined }))} className="input-field max-w-[120px] text-sm">
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unbilled">Unpaid</option>
            </select>
          )}
          {tab === 'leaves' && (
            <>
              <select value={extraFilter.leaveType || ''} onChange={e => setExtraFilter(f => ({ ...f, leaveType: e.target.value || undefined }))} className="input-field max-w-[120px] text-sm">
                <option value="">All Types</option>
                <option value="Annual">Annual</option>
                <option value="Sick">Sick</option>
                <option value="Absent">Absent</option>
                <option value="Unpaid">Unpaid</option>
              </select>
              <select value={extraFilter.status || ''} onChange={e => setExtraFilter(f => ({ ...f, status: e.target.value || undefined }))} className="input-field max-w-[120px] text-sm">
                <option value="">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </>
          )}
          {tab === 'advances' && (
            <select value={extraFilter.status || ''} onChange={e => setExtraFilter(f => ({ ...f, status: e.target.value || undefined }))} className="input-field max-w-[130px] text-sm">
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="fully_paid">Fully Paid</option>
            </select>
          )}

          <span className="w-px h-6 bg-gray-200 shrink-0" />

          {/* Date range */}
          <div className="flex items-center gap-2">
            <select value={datePreset === 'Custom' ? '' : datePreset} onChange={e => handlePresetClick(e.target.value)}
              className="input-field max-w-[135px] text-sm">
              <option value="" disabled>Select</option>
              {DATE_PRESETS.map(p => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
            <div className="relative">
              <button onClick={() => { setDatePreset('Custom'); setShowDatePopup(true); }}
                className={`text-xs font-medium rounded-lg transition-colors whitespace-nowrap border px-2.5 py-1.5 shrink-0 ${
                  datePreset === 'Custom'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 border-gray-300'
                }`}>
                <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Custom
              </button>
              {showDatePopup && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDatePopup(false)} />
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 w-[260px]">
                    <p className="text-xs font-semibold text-gray-700 mb-3">Select Date Range</p>
                    <label className="block text-xs text-gray-500 mb-1">From Date</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} max={today} className="input-field text-sm w-full mb-3" />
                    <label className="block text-xs text-gray-500 mb-1">To Date</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} max={today} className="input-field text-sm w-full mb-3" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowDatePopup(false); }} className="btn-primary !py-1.5 text-xs flex-1">Apply</button>
                      <button onClick={() => { setDatePreset('Current Month'); setCustomStart(''); setCustomEnd(''); setShowDatePopup(false); }} className="btn-secondary !py-1.5 text-xs">Reset</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {isFiltered && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap border px-2.5 py-1.5 text-gray-500 hover:text-red-600 hover:border-red-300 border-gray-300"
                title="Clear filters">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Clear
              </button>
            )}
            <button onClick={() => { setShowDeactivated(!showDeactivated); if (!showDeactivated) setSelectedEmployeeId(''); }}
              className={`btn-secondary !py-1.5 !px-2 text-xs relative group`}
              title={showDeactivated ? 'Showing deactivated staff' : 'Show deactivated staff'}>
              {showDeactivated
                ? <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              }
              {showDeactivated && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />}
            </button>
            <button onClick={() => handleExport('pdf')} className="btn-secondary !py-1.5 !px-2 text-xs" title="Export PDF">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={() => handleExport('xlsx')} className="btn-secondary !py-1.5 !px-2 text-xs" title="Export Excel">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {loading && <Loading />}

      {!loading && tab === 'dashboard' && renderDashboard()}
      {!loading && tab === 'salary' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SumCard label="Unpaid Amount" value={formatINR(summary?.totalSalaryPending)} subtitle={`${formatINR(summary?.totalSalaryPaid)} paid`} accent="amber" icon={<span className="text-base font-bold">₹</span>} />
            <SumCard label="Hours Logged" value={`${(summary?.totalHoursLogged || 0).toFixed(1)}h`} subtitle={`${(summary?.totalPaidHours || 0).toFixed(1)}h paid`} accent="sky" icon={<svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <SumCard label="Qty Logged" value={(summary?.totalQtyLogged || 0).toFixed(1)} subtitle={`${(summary?.totalQtyPaid || 0).toFixed(1)} paid`} accent="violet" icon={<svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>} />
          </div>
          {renderTable(salaryData, salaryColumns)}
        </>
      )}
      {!loading && tab === 'hours' && (
        <>
          {(() => {
            const totalHours = hoursData.reduce((s, r) => s + parseFloat(r.total_hours || 0), 0);
            const paidHours = hoursData.reduce((s, r) => s + (r.pay_status === 'paid' ? parseFloat(r.total_hours || 0) : 0), 0);
            const dueHours = totalHours - paidHours;
            const cards = [
              { label: 'Total Hours Logged', value: `${totalHours.toFixed(1)}h`, accent: 'indigo', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg> },
              { label: 'Total Paid Hours', value: `${paidHours.toFixed(1)}h`, accent: 'emerald', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: 'Total Unpaid Hours', value: `${dueHours.toFixed(1)}h`, accent: 'amber', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg> },
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {cards.map(c => <SumCard key={c.label} {...c} />)}
              </div>
            );
          })()}
          {renderTable(hoursData, hoursColumns)}
        </>
      )}
      {!loading && tab === 'piece-work' && (() => {
        const filtered = aggregatedPieceWork.filter(r => r.totalQty > 0);
        const totalQty = filtered.reduce((s, r) => s + r.totalQty, 0);
        const paidQty = filtered.reduce((s, r) => s + (r.allPaid ? r.totalQty : 0), 0);
        const dueQty = totalQty - paidQty;
        const cards = [
          { label: 'Total Qty Logged', value: totalQty, accent: 'indigo', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg> },
          { label: 'Total Paid Qty', value: paidQty, accent: 'emerald', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { label: 'Total Unpaid Qty', value: dueQty, accent: 'amber', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg> },
        ];
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {cards.map(c => <SumCard key={c.label} {...c} />)}
            </div>
            {renderTable(filtered, pieceWorkColumns)}
          </>
        );
      })()}
      {!loading && tab === 'leaves' && (() => {
        const total = leavesData.length;
        const approved = leavesData.filter(r => r.status === 'approved').length;
        const pending = leavesData.filter(r => r.status === 'pending').length;
        const rejected = leavesData.filter(r => r.status === 'rejected').length;
        const absent = leavesData.filter(r => (r.leave_type || '').toLowerCase() === 'absent').length;
        const leaveCards = [
          { label: 'Total Leaves', value: total, accent: 'indigo', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg> },
          { label: 'Approved', value: approved, accent: 'emerald', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { label: 'Pending', value: pending, accent: 'amber', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { label: 'Rejected', value: rejected, accent: 'rose', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { label: 'Absent', value: absent, accent: 'gray', icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg> },
        ];
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {leaveCards.map(c => <SumCard key={c.label} {...c} />)}
            </div>
            {renderTable(leavesData, leavesColumns)}
          </>
        );
      })()}
      {!loading && tab === 'advances' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SumCard label="Advance Issued" value={formatINR(advancesData.reduce((s, r) => s + parseInt(r.amount || 0), 0))} accent="rose" icon={<span className="text-base font-bold">₹</span>} />
            <SumCard label="Outstanding Advance" value={formatINR(advancesData.reduce((s, r) => s + parseInt(r.remaining_balance || 0), 0))} accent="orange" icon={<span className="text-base font-bold">₹</span>} />
          </div>
          {renderTable(advancesData, advancesColumns)}
        </>
      )}

      <PieceWorkModal
        open={!!pieceModal}
        onClose={() => setPieceModal(null)}
        entries={pieceModal?.entries || []}
        employeeName={pieceModal?.employeeName || ''}
        actualHours={pieceModal?.actualHours || 0}
        unitLabel={pieceModal?.unitLabel || 'pcs'}
      />

      {/* Mobile detail sheet */}
      {isMobile && selectedRecord && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`${selectedRecord.first_name || ''} ${selectedRecord.last_name || ''}`}
        >
          <div className="space-y-3">
            {tab === 'piece-work' ? (
              <>
                <DetailRow label="Date" value={selectedRecord.date ? new Date(selectedRecord.date).toLocaleDateString('en-IN') : '—'} />
                <DetailRow label="Total Qty" value={String(selectedRecord.totalQty)} />
                <DetailRow label="Total Amount" value={formatINR(selectedRecord.totalAmount)} />
                <DetailRow label="Status">
                  {selectedRecord.totalQty === 0 ? <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">Absent</span>
                    : selectedRecord.allPaid ? <span className="badge-success text-xs">Paid</span>
                    : <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Unpaid</span>}
                </DetailRow>
                {selectedRecord.workTypeDetails?.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Work Type Breakdown</p>
                    {selectedRecord.workTypeDetails.map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-1 text-xs border-b border-gray-50 last:border-0">
                        <span className="text-gray-800 font-medium">{e.work_type || '—'}</span>
                        <span className="text-gray-500">{e.quantity || 0} × ₹{((e.rate_per_piece || 0) / 100).toFixed(2)} = <span className="font-semibold text-gray-900">{formatINR(e.calculated_amount)}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : Object.entries(selectedRecord).filter(([k]) => !['id','tenant_id','employee_id'].includes(k)).map(([k, v]) => (
              <DetailRow key={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                value={v != null ? String(v) : '—'} />
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}
