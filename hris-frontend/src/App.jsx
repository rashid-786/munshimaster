import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { applyTheme } from './utils/currency';

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
import PlanSelection from './pages/auth/PlanSelection';
import Employees from './pages/admin/Employees';
import EmployeeCalendar from './pages/admin/EmployeeCalendar';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import PayrollConsole from './pages/admin/PayrollConsole';
import AdvancePayments from './pages/admin/AdvancePayments';
import Replacements from './pages/admin/Replacements';
import AuditLogs from './pages/admin/AuditLogs';
import BalanceSheet from './pages/admin/BalanceSheet';
import Reports from './pages/admin/Reports';
import PLStatement from './pages/admin/PLStatement';
import KiranaStore from './pages/admin/KiranaStore';
import Suppliers from './pages/admin/Suppliers';
import Customers from './pages/admin/Customers';
import PurchaseOrders from './pages/admin/PurchaseOrders';
import Invoices from './pages/admin/Invoices';
import Settings from './pages/admin/Settings';
import Referrals from './pages/admin/Referrals';
import PaymentHistory from './pages/admin/PaymentHistory';
import Workspace from './pages/employee/Workspace';
import Attendance from './pages/employee/Attendance';
import Profile from './pages/employee/Profile';
import MyAdvances from './pages/employee/MyAdvances';

// Super Admin
import SuperLayout from './layouts/SuperLayout';
import SuperLogin from './pages/super/SuperLogin';
import SuperDashboard from './pages/super/SuperDashboard';
import TenantManagement from './pages/super/TenantManagement';
import TenantDetail from './pages/super/TenantDetail';
import SuperSettings from './pages/super/SuperSettings';
import PlanRoute from './components/PlanRoute';

function App() {
  useEffect(() => {
    const savedColor = localStorage.getItem('primary_color') || '#4f46e5';
    applyTheme(savedColor);
  }, []);

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/super/login" element={<SuperLogin />} />

          <Route
            path="/super"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<SuperDashboard />} />
            <Route path="tenants" element={<TenantManagement />} />
            <Route path="tenants/:id" element={<TenantDetail />} />
            <Route path="settings" element={<SuperSettings />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['tenant_admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<PlanRoute minPlan="pro"><Employees /></PlanRoute>} />
            <Route path="calendar" element={<PlanRoute minPlan="pro"><EmployeeCalendar /></PlanRoute>} />
            <Route path="leaves" element={<PlanRoute minPlan="pro"><LeaveApprovals /></PlanRoute>} />
            <Route path="payroll" element={<PlanRoute minPlan="pro"><PayrollConsole /></PlanRoute>} />
            <Route path="advances" element={<PlanRoute minPlan="pro"><AdvancePayments /></PlanRoute>} />
            <Route path="replacements" element={<PlanRoute minPlan="pro"><Replacements /></PlanRoute>} />
            <Route path="audit-logs" element={<PlanRoute minPlan="pro"><AuditLogs /></PlanRoute>} />
            <Route path="balance" element={<PlanRoute minPlan="business"><BalanceSheet /></PlanRoute>} />
            <Route path="reports" element={<PlanRoute minPlan="business"><Reports /></PlanRoute>} />
            <Route path="pl" element={<PlanRoute minPlan="business"><PLStatement /></PlanRoute>} />
            <Route path="ledger" element={<KiranaStore />} />
            <Route path="ledger/:tab" element={<KiranaStore />} />
            <Route path="suppliers" element={<PlanRoute minPlan="business"><Suppliers /></PlanRoute>} />
            <Route path="customers" element={<PlanRoute minPlan="business"><Customers /></PlanRoute>} />
            <Route path="purchase-orders" element={<PlanRoute minPlan="business"><PurchaseOrders /></PlanRoute>} />
            <Route path="invoices" element={<PlanRoute minPlan="business"><Invoices /></PlanRoute>} />
            <Route path="payments" element={<PaymentHistory />} />
            <Route path="referrals" element={<Referrals />} />
            <Route path="settings" element={<Settings />} />
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

          <Route element={<LandingLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/blog" element={<Blogs />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />
          </Route>

          <Route path="/select-plan" element={<ProtectedRoute allowedRoles={['tenant_admin']}><PlanSelection /></ProtectedRoute>} />
          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center text-gray-500 text-xl">Unauthorized Access</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
