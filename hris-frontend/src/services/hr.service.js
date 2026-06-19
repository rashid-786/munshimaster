import api from './api';

export const hrService = {
  getEmployees: async (includeDeactivated) => {
    const params = includeDeactivated ? { includeDeactivated: 'true' } : {};
    const response = await api.get('/core/employees', { params });
    return response.data;
  },
  onboardEmployee: async (employeeData) => {
    const response = await api.post('/core/employees', employeeData);
    return response.data;
  },
  updateEmployee: async (id, data) => {
    const response = await api.put(`/core/employees/${id}`, data);
    return response.data;
  },
  deactivateEmployee: async (id) => {
    const response = await api.patch(`/core/employees/${id}/deactivate`);
    return response.data;
  },
  activateEmployee: async (id) => {
    const response = await api.patch(`/core/employees/${id}/activate`);
    return response.data;
  },
  deleteEmployee: async (id) => {
    const response = await api.delete(`/core/employees/${id}`);
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
  },

  // Suppliers
  getSuppliers: async (params) => {
    const response = await api.get('/core/suppliers', { params });
    return response.data;
  },
  getSupplier: async (id) => {
    const response = await api.get(`/core/suppliers/${id}`);
    return response.data;
  },
  createSupplier: async (data) => {
    const response = await api.post('/core/suppliers', data);
    return response.data;
  },
  updateSupplier: async (id, data) => {
    const response = await api.put(`/core/suppliers/${id}`, data);
    return response.data;
  },
  deleteSupplier: async (id) => {
    const response = await api.delete(`/core/suppliers/${id}`);
    return response.data;
  },
  deactivateSupplier: async (id) => {
    const response = await api.patch(`/core/suppliers/${id}/deactivate`);
    return response.data;
  },
  activateSupplier: async (id) => {
    const response = await api.patch(`/core/suppliers/${id}/activate`);
    return response.data;
  },

  // Customers
  getCustomers: async (params) => {
    const response = await api.get('/core/customers', { params });
    return response.data;
  },
  getCustomer: async (id) => {
    const response = await api.get(`/core/customers/${id}`);
    return response.data;
  },
  createCustomer: async (data) => {
    const response = await api.post('/core/customers', data);
    return response.data;
  },
  updateCustomer: async (id, data) => {
    const response = await api.put(`/core/customers/${id}`, data);
    return response.data;
  },
  deleteCustomer: async (id) => {
    const response = await api.delete(`/core/customers/${id}`);
    return response.data;
  },
  deactivateCustomer: async (id) => {
    const response = await api.patch(`/core/customers/${id}/deactivate`);
    return response.data;
  },
  activateCustomer: async (id) => {
    const response = await api.patch(`/core/customers/${id}/activate`);
    return response.data;
  },

  // Purchase Orders
  getPurchaseOrders: async (params) => {
    const response = await api.get('/core/purchase-orders', { params });
    return response.data;
  },
  getPurchaseOrder: async (id) => {
    const response = await api.get(`/core/purchase-orders/${id}`);
    return response.data;
  },
  createPurchaseOrder: async (data) => {
    const response = await api.post('/core/purchase-orders', data);
    return response.data;
  },
  updatePurchaseOrder: async (id, data) => {
    const response = await api.put(`/core/purchase-orders/${id}`, data);
    return response.data;
  },
  updatePurchaseOrderStatus: async (id, status) => {
    const response = await api.patch(`/core/purchase-orders/${id}/status`, { status });
    return response.data;
  },
  deletePurchaseOrder: async (id) => {
    const response = await api.delete(`/core/purchase-orders/${id}`);
    return response.data;
  },
  downloadPurchaseOrderPDF: async (id) => {
    const response = await api.get(`/core/purchase-orders/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PO-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Invoices
  getInvoices: async (params) => {
    const response = await api.get('/core/invoices', { params });
    return response.data;
  },
  getInvoice: async (id) => {
    const response = await api.get(`/core/invoices/${id}`);
    return response.data;
  },
  createInvoice: async (data) => {
    const response = await api.post('/core/invoices', data);
    return response.data;
  },
  updateInvoice: async (id, data) => {
    const response = await api.put(`/core/invoices/${id}`, data);
    return response.data;
  },
  updateInvoiceStatus: async (id, status) => {
    const response = await api.patch(`/core/invoices/${id}/status`, { status });
    return response.data;
  },
  deleteInvoice: async (id) => {
    const response = await api.delete(`/core/invoices/${id}`);
    return response.data;
  },
  downloadInvoicePDF: async (id) => {
    const response = await api.get(`/core/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `INV-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Attachments
  uploadFiles: async (entity_type, entity_id, files, onProgress) => {
    const formData = new FormData();
    formData.append('entity_type', entity_type);
    formData.append('entity_id', entity_id);
    for (const file of files) {
      formData.append('files', file);
    }
    const response = await api.post('/core/uploads', formData, {
      onUploadProgress: onProgress,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return response.data;
  },
  getAttachments: async (entity_type, entity_id) => {
    const response = await api.get('/core/uploads', { params: { entity_type, entity_id } });
    return response.data;
  },
  deleteAttachment: async (id) => {
    const response = await api.delete(`/core/uploads/${id}`);
    return response.data;
  },

  // Advances
  getAdvances: async () => {
    const response = await api.get('/core/advances');
    return response.data;
  },
  createAdvance: async (data) => {
    const response = await api.post('/core/advances', data);
    return response.data;
  },
  approveAdvance: async (id) => {
    const response = await api.patch(`/core/advances/${id}/approve`);
    return response.data;
  },
  rejectAdvance: async (id) => {
    const response = await api.patch(`/core/advances/${id}/reject`);
    return response.data;
  },

  // Kirana Store
  kirana: {
    getParties: async (params) => { const r = await api.get('/core/kirana/parties', { params }); return r.data; },
    createParty: async (data) => { const r = await api.post('/core/kirana/parties', data); return r.data; },
    getPartyDetails: async (id) => { const r = await api.get(`/core/kirana/parties/${id}`); return r.data; },
    updateParty: async (id, data) => { const r = await api.put(`/core/kirana/parties/${id}`, data); return r.data; },
    deleteParty: async (id) => { const r = await api.delete(`/core/kirana/parties/${id}`); return r.data; },
    createTransaction: async (data) => { const r = await api.post('/core/kirana/transactions', data); return r.data; },
    deleteTransaction: async (id) => { const r = await api.delete(`/core/kirana/transactions/${id}`); return r.data; },
    getSummary: async (params) => { const r = await api.get('/core/kirana/summary', { params }); return r.data; },
    getStaff: async () => { const r = await api.get('/core/kirana/staff'); return r.data; },
    createStaff: async (data) => { const r = await api.post('/core/kirana/staff', data); return r.data; },
    updateStaff: async (id, data) => { const r = await api.put(`/core/kirana/staff/${id}`, data); return r.data; },
    deleteStaff: async (id) => { const r = await api.delete(`/core/kirana/staff/${id}`); return r.data; },
    getCashbook: async (params) => { const r = await api.get('/core/kirana/cashbook', { params }); return r.data; },
    createCashEntry: async (data) => { const r = await api.post('/core/kirana/cashbook', data); return r.data; },
    updateCashEntry: async (id, data) => { const r = await api.put(`/core/kirana/cashbook/${id}`, data); return r.data; },
    deleteCashEntry: async (id) => { const r = await api.delete(`/core/kirana/cashbook/${id}`); return r.data; },
    getReport: async (params) => { const r = await api.get('/core/kirana/reports', { params }); return r.data; },
    downloadReportPDF: async (type, params) => {
      const response = await api.get('/core/reports/download/pdf', { params: { ...params, type }, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a'); link.href = window.URL.createObjectURL(blob); link.download = `${type}_report.pdf`; link.click();
    },
    downloadReportExcel: async (type, params) => {
      const response = await api.get('/core/reports/download/excel', { params: { ...params, type }, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a'); link.href = window.URL.createObjectURL(blob); link.download = `${type}_report.xlsx`; link.click();
    },
  },

  // Reports
  getReportData: async (params) => {
    const response = await api.get('/core/reports', { params });
    return response.data;
  },
  downloadReportPDF: async (type, params) => {
    const response = await api.get('/core/reports/download/pdf', { params: { ...params, type }, responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${type}_report.pdf`;
    link.click();
  },
  downloadReportExcel: async (type, params) => {
    const response = await api.get('/core/reports/download/excel', { params: { ...params, type }, responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${type}_report.xlsx`;
    link.click();
  },

  // Balance Sheet
  getBalanceEntries: async (params) => {
    const response = await api.get('/core/balance', { params });
    return response.data;
  },
  createBalanceEntry: async (data) => {
    const response = await api.post('/core/balance', data);
    return response.data;
  },
  updateBalanceEntry: async (id, data) => {
    const response = await api.put(`/core/balance/${id}`, data);
    return response.data;
  },
  deleteBalanceEntry: async (id) => {
    const response = await api.delete(`/core/balance/${id}`);
    return response.data;
  },

  // Profile
  changePassword: async (data) => {
    const response = await api.post('/core/profile/change-password', data);
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.put('/core/profile', data);
    return response.data;
  },

  // Subscription
  getPlans: async () => {
    const response = await api.get('/auth/plans');
    return response.data;
  },
  getSubscription: async () => {
    const response = await api.get('/core/subscription/plan');
    return response.data;
  },
  selectPlan: async (plan, phone) => {
    const response = await api.put('/core/subscription/plan', { plan, phone });
    return response.data;
  },
  getProfileCompletion: async () => {
    const response = await api.get('/core/subscription/profile-completion');
    return response.data;
  },
};
