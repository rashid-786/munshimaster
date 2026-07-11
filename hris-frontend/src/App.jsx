import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalConfigProvider } from './context/GlobalConfigContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import { applyTheme } from './utils/currency';
import { resolvePlan } from './config/subscriptionPlans';
import { getFirstDashboardRoute } from './config/subscriptionMenuBuilder';

import LandingLayout from './layouts/LandingLayout';
import AdminLayout from './layouts/AdminLayout';
import EmpLayout from './layouts/EmpLayout';

import Home from './pages/landing/Home';
import About from './pages/landing/About';
import Services from './pages/landing/Services';
import Faq from './pages/landing/Faq';
import Blogs from './pages/landing/Blogs';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Pricing from './pages/landing/Pricing';
import Employees from './pages/admin/Employees';
import EmployeeCalendar from './pages/admin/EmployeeCalendar';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import PayrollConsole from './pages/admin/PayrollConsole';
import AdvancePayments from './pages/admin/AdvancePayments';
import Replacements from './pages/admin/Replacements';
import StaffReports from './pages/admin/StaffReports';
import AuditLogs from './pages/admin/AuditLogs';
import BalanceSheet from './pages/admin/BalanceSheet';
import Reports from './pages/admin/Reports';
import PLStatement from './pages/admin/PLStatement';
import CashFlowStatement from './pages/admin/CashFlowStatement';
import KiranaStore from './pages/admin/KiranaStore';
import LedgerDashboard from './pages/admin/LedgerDashboard';
import BusinessDashboard from './pages/admin/BusinessDashboard';
import HrDashboard from './pages/admin/HrDashboard';
import Suppliers from './pages/admin/Suppliers';
import Customers from './pages/admin/Customers';
import PurchaseOrders from './pages/admin/PurchaseOrders';
import Invoices from './pages/admin/Invoices';
import Settings from './pages/admin/Settings';
import Referrals from './pages/admin/Referrals';
import PaymentHistory from './pages/admin/PaymentHistory';
import RecurringInvoices from './pages/admin/RecurringInvoices';
import BankImport from './pages/admin/BankImport';
import Products from './pages/admin/Products';
import CreditDebitNotes from './pages/admin/CreditDebitNotes';
import GstReturns from './pages/admin/GstReturns';
import Gstr2bReconciliation from './pages/admin/Gstr2bReconciliation';
import TDSManagement from './pages/admin/TDSManagement';
import TallyExport from './pages/admin/TallyExport';
import BulkImport from './pages/admin/BulkImport';
import Entities from './pages/admin/Entities';
import CustomerPortal from './pages/portal/CustomerPortal';
import Workspace from './pages/employee/Workspace';
import Attendance from './pages/employee/Attendance';
import Profile from './pages/employee/Profile';
import MyAdvances from './pages/employee/MyAdvances';

// Super Admin
import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperLogin from './pages/super/SuperLogin';
import Dashboard from './pages/super/Dashboard';
import Tenants from './pages/super/Tenants';
import TenantDetail from './pages/super/TenantDetail';
import SubscriptionPlans from './pages/super/SubscriptionPlans';
import Campaigns from './pages/super/Campaigns';
import SuperReferrals from './pages/super/Referrals';

import RevenueAnalytics from './pages/super/RevenueAnalytics';
import ConversionAnalytics from './pages/super/ConversionAnalytics';
import PlanAdoption from './pages/super/PlanAdoption';
import UsageAnalytics from './pages/super/UsageAnalytics';
import SuperAuditLogs from './pages/super/SuperAuditLogs';
import GlobalConfig from './pages/super/GlobalConfig';
import PlanRoute from './components/PlanRoute';
import UsageDashboard from './pages/admin/UsageDashboard';
import SubscriptionSettings from './pages/admin/SubscriptionSettings';

function getHiddenGroups() {
  try {
    const stored = localStorage.getItem('hidden_groups');
    if (stored) return JSON.parse(stored);
    const tenantData = JSON.parse(localStorage.getItem('tenant_data') || '{}');
    return tenantData?.settings?.hiddenGroups || {};
  } catch {
    return {};
  }
}

function DefaultRedirect() {
  let { tenant } = useAuth();
  if (!tenant) {
    try { const saved = localStorage.getItem('tenant_data'); if (saved) tenant = JSON.parse(saved); } catch {}
  }
  const plan = resolvePlan(tenant?.subscriptionPlan || 'FREE');
  const hiddenGroups = getHiddenGroups();
  if (plan === 'BUSINESS' || plan === 'BUSINESS_PRO') return <Navigate to="business" replace />;
  const route = getFirstDashboardRoute(plan, hiddenGroups);
  return <Navigate to={route.replace('/admin/', '')} replace />;
}

function App() {
  useEffect(() => {
    const savedColor = localStorage.getItem('primary_color') || '#4f46e5';
    applyTheme(savedColor);
  }, []);

  return (
    <AuthProvider>
      <GlobalConfigProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/super/login" element={<SuperLogin />} />

          <Route
            path="/super"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tenants" element={<Tenants />} />
            <Route path="tenants/:id" element={<TenantDetail />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="referrals" element={<SuperReferrals />} />
            <Route path="plans" element={<SubscriptionPlans />} />
            <Route path="analytics/revenue" element={<RevenueAnalytics />} />
            <Route path="analytics/conversion" element={<ConversionAnalytics />} />
            <Route path="analytics/plan-adoption" element={<PlanAdoption />} />
            <Route path="analytics/usage" element={<UsageAnalytics />} />
            <Route path="audit-logs" element={<SuperAuditLogs />} />
            <Route path="global-config" element={<GlobalConfig />} />

          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['tenant_admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DefaultRedirect />} />
            <Route path="employees" element={<PlanRoute minPlan="pro"><Employees /></PlanRoute>} />
            <Route path="calendar" element={<PlanRoute minPlan="pro"><EmployeeCalendar /></PlanRoute>} />
            <Route path="leaves" element={<PlanRoute minPlan="pro"><LeaveApprovals /></PlanRoute>} />
            <Route path="payroll" element={<PlanRoute minPlan="pro"><PayrollConsole /></PlanRoute>} />
            <Route path="advances" element={<PlanRoute minPlan="pro"><AdvancePayments /></PlanRoute>} />
            <Route path="replacements" element={<PlanRoute minPlan="pro"><Replacements /></PlanRoute>} />
            <Route path="staff-reports" element={<PlanRoute minPlan="pro"><StaffReports /></PlanRoute>} />
            <Route path="audit-logs" element={<PlanRoute minPlan="pro"><AuditLogs /></PlanRoute>} />
            <Route path="balance" element={<PlanRoute minPlan="business"><BalanceSheet /></PlanRoute>} />
            <Route path="reports" element={<PlanRoute minPlan="business"><Reports /></PlanRoute>} />
            <Route path="pl" element={<PlanRoute minPlan="business"><PLStatement /></PlanRoute>} />
            <Route path="cash-flow" element={<PlanRoute minPlan="business"><CashFlowStatement /></PlanRoute>} />
            <Route path="ledger" element={<PlanRoute minPlan="free"><LedgerDashboard /></PlanRoute>} />
            <Route path="ledger/:tab" element={<PlanRoute minPlan="free"><KiranaStore /></PlanRoute>} />
            <Route path="business" element={<PlanRoute minPlan="business"><BusinessDashboard /></PlanRoute>} />
            <Route path="hr" element={<PlanRoute minPlan="pro"><HrDashboard /></PlanRoute>} />
            <Route path="suppliers" element={<PlanRoute minPlan="business"><Suppliers /></PlanRoute>} />
            <Route path="customers" element={<PlanRoute minPlan="business"><Customers /></PlanRoute>} />
            <Route path="purchase-orders" element={<PlanRoute minPlan="business"><PurchaseOrders /></PlanRoute>} />
            <Route path="invoices" element={<PlanRoute minPlan="business"><Invoices /></PlanRoute>} />
            <Route path="recurring-invoices" element={<PlanRoute minPlan="business"><RecurringInvoices /></PlanRoute>} />
            <Route path="bank" element={<PlanRoute minPlan="business"><BankImport /></PlanRoute>} />
            <Route path="notes" element={<PlanRoute minPlan="business"><CreditDebitNotes /></PlanRoute>} />
            <Route path="gst-returns" element={<PlanRoute minPlan="business"><GstReturns /></PlanRoute>} />
            <Route path="gstr2b" element={<PlanRoute minPlan="business"><Gstr2bReconciliation /></PlanRoute>} />
            <Route path="tds" element={<PlanRoute minPlan="business"><TDSManagement /></PlanRoute>} />
            <Route path="tally" element={<PlanRoute minPlan="business"><TallyExport /></PlanRoute>} />
            <Route path="bulk-import" element={<PlanRoute minPlan="business"><BulkImport /></PlanRoute>} />
            <Route path="entities" element={<Entities />} />
            <Route path="products" element={<PlanRoute minPlan="business"><Products /></PlanRoute>} />
            <Route path="payments" element={<PaymentHistory />} />
            <Route path="referrals" element={<Referrals />} />
            <Route path="usage" element={<UsageDashboard />} />
            <Route path="subscription" element={<SubscriptionSettings />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/:tab" element={<Settings />} />
          </Route>

          <Route
            path="/employee"
            element={
              <ProtectedRoute allowedRoles={['employee', 'tenant_admin']}>
                <EmpLayout />
              </ProtectedRoute>
            }
          >
            <Route path="profile" element={<Workspace />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="leaves" element={<LeaveApprovals />} />
            <Route path="payslips" element={<Profile />} />
            <Route path="advances" element={<MyAdvances />} />
          </Route>

          <Route element={<PublicRoute><LandingLayout /></PublicRoute>}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/blog" element={<Blogs />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />
          </Route>

          <Route path="/portal/:token" element={<CustomerPortal />} />
          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center text-gray-500 text-xl">Unauthorized Access</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </GlobalConfigProvider>
    </AuthProvider>
  );
}

export default App;
