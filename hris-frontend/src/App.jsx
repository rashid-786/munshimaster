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
import Employees from './pages/admin/Employees';
import EmployeeCalendar from './pages/admin/EmployeeCalendar';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import PayrollConsole from './pages/admin/PayrollConsole';
import AdvancePayments from './pages/admin/AdvancePayments';
import BalanceSheet from './pages/admin/BalanceSheet';
import Reports from './pages/admin/Reports';
import KiranaStore from './pages/admin/KiranaStore';
import Suppliers from './pages/admin/Suppliers';
import Customers from './pages/admin/Customers';
import PurchaseOrders from './pages/admin/PurchaseOrders';
import Invoices from './pages/admin/Invoices';
import Settings from './pages/admin/Settings';
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
import AllEmployees from './pages/super/AllEmployees';

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
            <Route path="employees" element={<AllEmployees />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['tenant_admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Employees />} />
            <Route path="calendar" element={<EmployeeCalendar />} />
            <Route path="leaves" element={<LeaveApprovals />} />
            <Route path="payroll" element={<PayrollConsole />} />
            <Route path="advances" element={<AdvancePayments />} />
            <Route path="balance" element={<BalanceSheet />} />
            <Route path="reports" element={<Reports />} />
            <Route path="ledger" element={<KiranaStore />} />
            <Route path="ledger/:tab" element={<KiranaStore />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="customers" element={<Customers />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="invoices" element={<Invoices />} />
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
          </Route>

          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center text-gray-500 text-xl">Unauthorized Access</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
