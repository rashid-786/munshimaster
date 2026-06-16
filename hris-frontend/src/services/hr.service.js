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

  // Profile
  changePassword: async (data) => {
    const response = await api.post('/core/profile/change-password', data);
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.put('/core/profile', data);
    return response.data;
  },
};
