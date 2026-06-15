import api from './api';

export const hrService = {
  getEmployees: async () => {
    const response = await api.get('/core/employees');
    return response.data;
  },
  onboardEmployee: async (employeeData) => {
    const response = await api.post('/core/employees', employeeData);
    return response.data;
  },
  clockIn: async () => {
    const response = await api.post('/core/time/attendance/clock-in');
    return response.data;
  },
  clockOut: async () => {
    const response = await api.post('/core/time/attendance/clock-out');
    return response.data;
  },
  applyLeave: async (leaveData) => {
    const response = await api.post('/core/time/leaves/apply', leaveData);
    return response.data;
  },
  getLeaves: async () => {
    const response = await api.get('/core/time/leaves');
    return response.data;
  },
  reviewLeave: async (leaveId, status) => {
    const response = await api.patch('/core/time/leaves/review', { leaveId, status });
    return response.data;
  },
  runPayroll: async (payrollParameters) => {
    const response = await api.post('/core/payroll/calculate', payrollParameters);
    return response.data;
  },
  getPayrollHistory: async () => {
    const response = await api.get('/core/payroll/history');
    return response.data;
  },
  downloadPayslipUrl: (payrollId) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const tenantId = localStorage.getItem('tenant_id');
    // Standard non-bearer raw navigation fallback bypass requires browser intercept stream allocation
    return `${baseUrl}/payroll/download/${payrollId}`;
  },
  downloadPayslipFile: async (payrollId) => {
    const response = await api.get(`/core/payroll/download/${payrollId}`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `payslip_${payrollId}.pdf`;
    link.click();
  },
  getTenantSettings: async () => {
    const response = await api.get('/core/tenant/settings');
    return response.data;
  },
  updateTenantSettings: async (settingsPayload) => {
    const response = await api.put('/core/tenant/settings', settingsPayload);
    return response.data;
  },
  logEmployeeHoursManually: async (attendancePayload) => {
    const response = await api.post('/core/time/attendance/admin-log', attendancePayload);
    return response.data;
  },
  getEmployeeCalendar: async (params) => {
    const response = await api.get('/core/time/attendance/calendar', { params });
    return response.data;
  },
  adminLogAttendance: async (payload) => {
    const response = await api.post('/core/time/attendance/admin-log', payload);
    return response.data;
  },
  deleteAttendance: async (employeeId, date) => {
    const response = await api.delete(`/core/time/attendance/admin-log/${employeeId}/${date}`);
    return response.data;
  },
  adminSetStatus: async (payload) => {
    const response = await api.post('/core/time/attendance/admin-set-status', payload);
    return response.data;
  }
};
