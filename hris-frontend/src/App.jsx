import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import EmpLayout from './layouts/EmpLayout';

import Login from './pages/auth/Login';
import Employees from './pages/admin/Employees';
import EmployeeCalendar from './pages/admin/EmployeeCalendar';
import LeaveApprovals from './pages/admin/LeaveApprovals';
import PayrollConsole from './pages/admin/PayrollConsole';
import Settings from './pages/admin/Settings';
import Workspace from './pages/employee/Workspace';
import Attendance from './pages/employee/Attendance';
import Profile from './pages/employee/Profile';

function App() {
  useEffect(() => {
    const savedColor = localStorage.getItem('primary_color') || '#4f46e5';
    document.documentElement.style.setProperty('--primary', savedColor);
  }, []);

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
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
          </Route>

          <Route path="/unauthorized" element={<div className="min-h-screen flex items-center justify-center text-gray-500 text-xl">Unauthorized Access</div>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
