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
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/core/audit-logs', { params });
    return response.data;
  },
  getAuditActions: async () => {
    const response = await api.get('/core/audit-logs/actions');
    return response.data;
  },
  getAuditDetail: async (id) => {
    const response = await api.get(`/core/audit-logs/${id}`);
    return response.data;
  },
  downloadImportTemplate: async () => {
    const response = await api.get('/core/employees/import/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'staff_import_template.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  previewImport: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/core/employees/import/preview', formData);
    return response.data;
  },
  executeImport: async (data) => {
    const response = await api.post('/core/employees/import/execute', data);
    return response.data;
  },
  adminCreateLeave: async (leaveData) => {
    const response = await api.post('/core/time/leaves/admin-create', leaveData);
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
  updateLeave: async (id, data) => {
    const response = await api.put(`/core/time/leaves/${id}`, data);
    return response.data;
  },
  deleteLeave: async (id) => {
    const response = await api.delete(`/core/time/leaves/${id}`);
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
  markPayrollPaid: async (payrollId) => {
    const response = await api.patch(`/core/payroll/${payrollId}/pay`);
    return response.data;
  },
  deletePayrollHistory: async (ids) => {
    const response = await api.post('/core/payroll/batch-delete', { ids });
    return response.data;
  },
  updateManualAdvanceDeduction: async (payrollId, advanceDeduction) => {
    const response = await api.patch(`/core/payroll/${payrollId}/manual-advance-deduction`, { advanceDeduction });
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
  getTenantSections: async () => {
    const response = await api.get('/core/tenant/sections');
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
  emailInvoice: async (id) => {
    const response = await api.post(`/core/invoices/${id}/email`);
    return response.data;
  },
  emailPurchaseOrder: async (id) => {
    const response = await api.post(`/core/purchase-orders/${id}/email`);
    return response.data;
  },
  getEmailLogs: async (entityType, entityId) => {
    const response = await api.get('/core/email-logs', { params: { entity_type: entityType, entity_id: entityId } });
    return response.data;
  },

  // Bulk Operations
  bulkDeleteInvoices: async (ids) => {
    const response = await api.post('/core/invoices/bulk/delete', { ids });
    return response.data;
  },
  bulkExportInvoices: async (ids) => {
    const response = await api.post('/core/invoices/bulk/export', { ids }, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'invoices_export.xlsx';
    link.click();
  },
  bulkDeletePOs: async (ids) => {
    const response = await api.post('/core/purchase-orders/bulk/delete', { ids });
    return response.data;
  },
  bulkExportPOs: async (ids) => {
    const response = await api.post('/core/purchase-orders/bulk/export', { ids }, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'po_export.xlsx';
    link.click();
  },

  // Inventory / Products
  getProducts: async (params) => {
    const response = await api.get('/core/products', { params });
    return response.data;
  },
  getProduct: async (id) => {
    const response = await api.get(`/core/products/${id}`);
    return response.data;
  },
  createProduct: async (data) => {
    const response = await api.post('/core/products', data);
    return response.data;
  },
  updateProduct: async (id, data) => {
    const response = await api.put(`/core/products/${id}`, data);
    return response.data;
  },
  deleteProduct: async (id) => {
    const response = await api.delete(`/core/products/${id}`);
    return response.data;
  },
  bulkDeleteProducts: async (ids) => {
    const response = await api.post('/core/products/bulk/delete', { ids });
    return response.data;
  },
  getStockMovements: async (params) => {
    const response = await api.get('/core/stock/movements', { params });
    return response.data;
  },
  recordStockMovement: async (data) => {
    const response = await api.post('/core/stock/movements', data);
    return response.data;
  },
  getLowStockAlerts: async () => {
    const response = await api.get('/core/stock/alerts');
    return response.data;
  },
  getStockSummary: async () => {
    const response = await api.get('/core/stock/summary');
    return response.data;
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
  updateAdvance: async (id, data) => {
    const response = await api.put(`/core/advances/${id}`, data);
    return response.data;
  },
  deleteAdvance: async (id) => {
    const response = await api.delete(`/core/advances/${id}`);
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
    getCashbook: async (params) => { const r = await api.get('/core/kirana/cashbook', { params }); return r.data; },
    createCashEntry: async (data) => { const r = await api.post('/core/kirana/cashbook', data); return r.data; },
    updateCashEntry: async (id, data) => { const r = await api.put(`/core/kirana/cashbook/${id}`, data); return r.data; },
    deleteCashEntry: async (id) => { const r = await api.delete(`/core/kirana/cashbook/${id}`); return r.data; },
    getReport: async (params) => { const r = await api.get('/core/kirana/reports', { params }); return r.data; },
    downloadReportExcel: async (type, params) => {
      const mapType = { kirana_party: 'parties', kirana_cashbook: 'cashbook' };
      const response = await api.get('/core/kirana/reports/download/excel', { params: { ...params, type: mapType[type] || type }, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a'); link.href = window.URL.createObjectURL(blob); link.download = `${type}_report.xlsx`; link.click();
    },
    getKiranaReportData: async (params) => {
      const mapType = { kirana_party: 'parties', kirana_cashbook: 'cashbook' };
      const response = await api.get('/core/kirana/reports', { params: { ...params, type: mapType[params.type] || params.type } });
      return response.data;
    },
  },

  // Reports
  getReportData: async (params) => {
    const response = await api.get('/core/reports', { params });
    return response.data;
  },
  getPLStatement: async (params) => {
    const response = await api.get('/core/reports/pl', { params });
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

  // Staff Reports
  getStaffReportSummary: async (params) => {
    const response = await api.get('/core/staff-reports/summary', { params });
    return response.data;
  },
  getSalaryReport: async (params) => {
    const response = await api.get('/core/staff-reports/salary', { params });
    return response.data;
  },
  getWorkingHoursReport: async (params) => {
    const response = await api.get('/core/staff-reports/working-hours', { params });
    return response.data;
  },
  getLeaveReport: async (params) => {
    const response = await api.get('/core/staff-reports/leaves', { params });
    return response.data;
  },
  getAdvanceReport: async (params) => {
    const response = await api.get('/core/staff-reports/advances', { params });
    return response.data;
  },
  getStaffReportCharts: async (params) => {
    const response = await api.get('/core/staff-reports/charts', { params });
    return response.data;
  },
  downloadStaffReport: async (tab, format, params) => {
    const response = await api.get(`/core/staff-reports/export/${tab}/${format}`, { params, responseType: 'blob' });
    const blob = new Blob([response.data], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${tab}_report.${format}`;
    link.click();
  },

  // Payment Reconciliation
  recordPayment: async (invoiceId, data) => {
    const response = await api.post(`/core/invoices/${invoiceId}/payments`, data);
    return response.data;
  },
  getInvoicePayments: async (invoiceId) => {
    const response = await api.get(`/core/invoices/${invoiceId}/payments`);
    return response.data;
  },
  deletePayment: async (invoiceId, paymentId) => {
    const response = await api.delete(`/core/invoices/${invoiceId}/payments/${paymentId}`);
    return response.data;
  },
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

  // Replacements
  getReplacements: async (params) => {
    const response = await api.get('/core/replacements', { params });
    return response.data;
  },
  createReplacement: async (data) => {
    const response = await api.post('/core/replacements', data);
    return response.data;
  },
  endReplacement: async (id) => {
    const response = await api.patch(`/core/replacements/${id}/end`);
    return response.data;
  },
  deleteReplacement: async (id) => {
    const response = await api.delete(`/core/replacements/${id}`);
    return response.data;
  },

  getNotifications: async () => {
    const response = await api.get('/core/notifications');
    return response.data;
  },
  markNotificationRead: async (id) => {
    const response = await api.patch(`/core/notifications/${id}/read`);
    return response.data;
  },
  markAllNotificationsRead: async () => {
    const response = await api.patch('/core/notifications/read-all');
    return response.data;
  },
  getDashboard: async () => {
    const response = await api.get('/core/dashboard');
    return response.data;
  },
  getBusinessDashboard: async (period) => {
    const response = await api.get('/core/dashboard/business', { params: { period } });
    return response.data;
  },
  globalSearch: async (q) => {
    const response = await api.get('/core/search', { params: { q } });
    return response.data;
  },
  getRecurringTemplates: async (params) => {
    const response = await api.get('/core/recurring-invoices', { params });
    return response.data;
  },
  getRecurringTemplate: async (id) => {
    const response = await api.get(`/core/recurring-invoices/${id}`);
    return response.data;
  },
  createRecurringTemplate: async (data) => {
    const response = await api.post('/core/recurring-invoices', data);
    return response.data;
  },
  updateRecurringTemplate: async (id, data) => {
    const response = await api.put(`/core/recurring-invoices/${id}`, data);
    return response.data;
  },
  toggleRecurringTemplate: async (id, isActive) => {
    const response = await api.patch(`/core/recurring-invoices/${id}/toggle`, { is_active: isActive });
    return response.data;
  },
  deleteRecurringTemplate: async (id) => {
    const response = await api.delete(`/core/recurring-invoices/${id}`);
    return response.data;
  },
  generateRecurringInvoice: async (id) => {
    const response = await api.post(`/core/recurring-invoices/${id}/generate`);
    return response.data;
  },
  bankImportPreview: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/core/bank/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  },
  bankImportConfirm: async (rows) => {
    const response = await api.post('/core/bank/import/confirm', { rows });
    return response.data;
  },
  bankGetTransactions: async (params) => {
    const response = await api.get('/core/bank/transactions', { params });
    return response.data;
  },
  bankGetImports: async () => {
    const response = await api.get('/core/bank/imports');
    return response.data;
  },
  bankCategorize: async (id, category) => {
    const response = await api.patch(`/core/bank/transactions/${id}/categorize`, { category });
    return response.data;
  },
  bankMatch: async (id, invoiceId) => {
    const response = await api.patch(`/core/bank/transactions/${id}/match`, { invoice_id: invoiceId });
    return response.data;
  },
  whatsappGetSettings: async () => {
    const response = await api.get('/core/whatsapp/settings');
    return response.data;
  },
  whatsappSendInvoice: async (id) => {
    const response = await api.post(`/core/whatsapp/send/invoice/${id}`);
    return response.data;
  },
  whatsappSendPO: async (id) => {
    const response = await api.post(`/core/whatsapp/send/purchase-order/${id}`);
    return response.data;
  },
  whatsappSendPaymentReminder: async (id) => {
    const response = await api.post(`/core/whatsapp/send/payment-reminder/${id}`);
    return response.data;
  },
  whatsappGetLogs: async (params) => {
    const response = await api.get('/core/whatsapp/logs', { params });
    return response.data;
  },
  generateEinvoice: async (id) => {
    const response = await api.post(`/core/einvoice/${id}/generate`);
    return response.data;
  },
  cancelEinvoice: async (id, reason) => {
    const response = await api.post(`/core/einvoice/${id}/cancel`, { reason });
    return response.data;
  },
  getEinvoiceStatus: async (id) => {
    const response = await api.get(`/core/einvoice/${id}/status`);
    return response.data;
  },
  getEinvoiceQrCode: async (id) => {
    const response = await api.get(`/core/einvoice/${id}/qrcode`);
    return response.data;
  },
  generatePaymentLink: async (id) => {
    const response = await api.post(`/core/invoice-payments/${id}/generate`);
    return response.data;
  },
  cancelPaymentLink: async (id) => {
    const response = await api.post(`/core/invoice-payments/${id}/cancel`);
    return response.data;
  },
  getNotes: async (type, params) => {
    const response = await api.get(`/core/notes/${type}`, { params });
    return response.data;
  },
  getNote: async (type, id) => {
    const response = await api.get(`/core/notes/${type}/${id}`);
    return response.data;
  },
  createNote: async (type, data) => {
    const response = await api.post(`/core/notes/${type}`, data);
    return response.data;
  },
  updateNoteStatus: async (type, id, status) => {
    const response = await api.patch(`/core/notes/${type}/${id}/status`, { status });
    return response.data;
  },
  deleteNote: async (type, id) => {
    const response = await api.delete(`/core/notes/${type}/${id}`);
    return response.data;
  },
  getGstr1: async (from, to) => {
    const response = await api.get('/core/gst-returns/gstr1', { params: { from, to } });
    return response.data;
  },
  downloadGstr1Json: async (from, to) => {
    const response = await api.get('/core/gst-returns/gstr1/download', {
      params: { from, to },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const match = response.headers['content-disposition']?.match(/filename=(.+)/);
    link.setAttribute('download', match ? match[1] : `GSTR1_${from}_${to}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return response.data;
  },
  getGstr3b: async (from, to) => {
    const response = await api.get('/core/gst-returns/gstr3b', { params: { from, to } });
    return response.data;
  },
  generateEwaybill: async (id, transport) => {
    const response = await api.post(`/core/ewaybill/${id}/generate`, transport);
    return response.data;
  },
  cancelEwaybill: async (id, reason) => {
    const response = await api.post(`/core/ewaybill/${id}/cancel`, { reason });
    return response.data;
  },
  getEwaybillStatus: async (id) => {
    const response = await api.get(`/core/ewaybill/${id}/status`);
    return response.data;
  },
  uploadGstr2b: async (period, jsonData) => {
    const response = await api.post('/core/gstr2b/upload', { period, jsonData }, { timeout: 30000 });
    return response.data;
  },
  getGstr2bImports: async () => {
    const response = await api.get('/core/gstr2b/imports');
    return response.data;
  },
  getGstr2bItems: async (params) => {
    const response = await api.get('/core/gstr2b/items', { params });
    return response.data;
  },
  getGstr2bStats: async () => {
    const response = await api.get('/core/gstr2b/stats');
    return response.data;
  },
  matchGstr2bItem: async (id, poId) => {
    const response = await api.post(`/core/gstr2b/items/${id}/match`, { poId });
    return response.data;
  },
  unmatchGstr2bItem: async (id) => {
    const response = await api.post(`/core/gstr2b/items/${id}/unmatch`);
    return response.data;
  },
  deleteGstr2bImport: async (id) => {
    const response = await api.delete(`/core/gstr2b/imports/${id}`);
    return response.data;
  },
  getTdsSections: async () => {
    const response = await api.get('/core/tds/sections');
    return response.data;
  },
  getTdsDeductions: async (params) => {
    const response = await api.get('/core/tds/deductions', { params });
    return response.data;
  },
  createTdsDeduction: async (data) => {
    const response = await api.post('/core/tds/deductions', data);
    return response.data;
  },
  updateTdsDeduction: async (id, data) => {
    const response = await api.put(`/core/tds/deductions/${id}`, data);
    return response.data;
  },
  deleteTdsDeduction: async (id) => {
    const response = await api.delete(`/core/tds/deductions/${id}`);
    return response.data;
  },
  getTdsChallans: async (params) => {
    const response = await api.get('/core/tds/challans', { params });
    return response.data;
  },
  createTdsChallan: async (data) => {
    const response = await api.post('/core/tds/challans', data);
    return response.data;
  },
  getTdsSummary: async (period) => {
    const response = await api.get('/core/tds/summary', { params: period ? { period } : {} });
    return response.data;
  },
  tallyExport: async (type, params) => {
    const response = await api.get(`/core/tally/${type}`, { params, responseType: 'blob' });
    return response.data;
  },
  bulkImportPreview: async (entityType, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/core/bulk-import/${entityType}/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  },
  bulkImportConfirm: async (entityType, rows) => {
    const response = await api.post(`/core/bulk-import/${entityType}/confirm`, { rows }, { timeout: 60000 });
    return response.data;
  },
  getCashFlow: async (from, to) => {
    const response = await api.get('/core/cash-flow', { params: { from, to } });
    return response.data;
  },
  getKhataSummary: async () => {
    const response = await api.get('/core/khata/summary');
    return response.data;
  },
  getKhataCustomers: async (search) => {
    const response = await api.get('/core/khata/customers', { params: search ? { search } : {} });
    return response.data;
  },
  getKhataCustomerDetail: async (id) => {
    const response = await api.get(`/core/khata/customers/${id}`);
    return response.data;
  },
  generatePortalLink: async (customerId) => {
    const response = await api.post(`/core/khata/customers/${customerId}/token`);
    return response.data;
  },
  sendKhataReminder: async (customerId, type) => {
    const response = await api.post(`/core/khata/customers/${customerId}/reminder`, { type });
    return response.data;
  },
  verifyPortalToken: async (token) => {
    const response = await api.get(`/public/portal/${token}`);
    return response.data;
  },
  getEntities: async () => {
    const response = await api.get('/core/entities');
    return response.data;
  },
  createEntity: async (data) => {
    const response = await api.post('/core/entities', data);
    return response.data;
  },
  switchEntity: async (targetTenantId) => {
    const response = await api.post('/core/entities/switch', { targetTenantId });
    return response.data;
  },
  updateEntity: async (id, data) => {
    const response = await api.put(`/core/entities/${id}`, data);
    return response.data;
  },
  deleteEntity: async (id) => {
    const response = await api.delete(`/core/entities/${id}`);
    return response.data;
  },
  getConsolidatedPL: async (from, to) => {
    const response = await api.get('/core/reports/consolidated/pl', { params: { from, to } });
    return response.data;
  },
};
