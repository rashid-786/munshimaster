export const DIRECTION = {
  sales_invoice: 'sales', payment_in: 'sales', sales_return: 'sales', credit_note: 'sales',
  delivery_challan: 'sales', quotation: 'sales', proforma_invoice: 'sales',
  purchase_invoice: 'purchase', payment_out: 'purchase', purchase_return: 'purchase',
  debit_note: 'purchase', purchase_order: 'purchase',
};

export const DOC_LABELS = {
  sales_invoice: 'Sales Invoice', payment_in: 'Payment Received', sales_return: 'Sales Return',
  credit_note: 'Credit Note', delivery_challan: 'Delivery Challan', quotation: 'Quotation',
  proforma_invoice: 'Proforma Invoice', purchase_invoice: 'Purchase Invoice',
  payment_out: 'Payment Made', purchase_return: 'Purchase Return', debit_note: 'Debit Note',
  purchase_order: 'Purchase Order',
};

export const DOC_PREFIXES = {
  sales_invoice: 'INV', payment_in: 'PAYIN', sales_return: 'SR', credit_note: 'CN',
  delivery_challan: 'DC', quotation: 'QTN', proforma_invoice: 'PRO',
  purchase_invoice: 'BILL', payment_out: 'PAYOUT', purchase_return: 'PR', debit_note: 'DN',
  purchase_order: 'PO',
};

export const PARTY_TYPE = {
  sales_invoice: 'customer', payment_in: 'customer', sales_return: 'customer', credit_note: 'customer',
  delivery_challan: 'customer', quotation: 'customer', proforma_invoice: 'customer',
  purchase_invoice: 'supplier', payment_out: 'supplier', purchase_return: 'supplier',
  debit_note: 'supplier', purchase_order: 'supplier',
};

export const STATUS_OPTIONS = {
  sales_invoice: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
  payment_in: ['draft', 'completed', 'cancelled'],
  sales_return: ['draft', 'issued', 'cancelled'],
  credit_note: ['draft', 'issued', 'cancelled'],
  delivery_challan: ['draft', 'sent', 'delivered', 'cancelled'],
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'],
  proforma_invoice: ['draft', 'sent', 'converted', 'cancelled'],
  purchase_invoice: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
  payment_out: ['draft', 'completed', 'cancelled'],
  purchase_return: ['draft', 'issued', 'cancelled'],
  debit_note: ['draft', 'issued', 'cancelled'],
  purchase_order: ['draft', 'sent', 'approved', 'received', 'cancelled'],
};

export const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', partial: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700', cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700', issued: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-teal-100 text-teal-700', accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', expired: 'bg-gray-100 text-gray-600',
  converted: 'bg-purple-100 text-purple-700', approved: 'bg-indigo-100 text-indigo-700',
  received: 'bg-teal-100 text-teal-700',
};

const COMMON_FIELDS = {
  party: true, docNumber: true, docDate: true, billingAddress: true, shippingAddress: true,
  lineItems: true, notes: true, totals: true, status: true,
};

export const DOCUMENT_CONFIG = {
  sales_invoice: {
    direction: 'sales', label: 'Sales Invoice', partyType: 'customer', fields: {
      ...COMMON_FIELDS, dueDate: true, placeOfSupply: true,
    }, conversions: [],
  },
  payment_in: {
    direction: 'sales', label: 'Payment Received', partyType: 'customer', fields: {
      party: true, docNumber: true, docDate: true, paymentMode: true, paymentReference: true,
      outstandingList: true, notes: true,
    }, conversions: [],
  },
  quotation: {
    direction: 'sales', label: 'Quotation', partyType: 'customer', fields: {
      party: true, docNumber: true, docDate: true, dueDate: true,
      placeOfSupply: true, lineItems: true, notes: true, totals: true, status: true,
    }, conversions: ['proforma_invoice', 'sales_invoice'],
  },
  proforma_invoice: {
    direction: 'sales', label: 'Proforma Invoice', partyType: 'customer', fields: {
      party: true, docNumber: true, docDate: true, dueDate: true,
      placeOfSupply: true, lineItems: true, notes: true, totals: true, status: true,
    }, conversions: ['sales_invoice'],
  },
  sales_return: {
    direction: 'sales', label: 'Sales Return', partyType: 'customer', fields: {
      party: true, docNumber: true, docDate: true, referenceNumber: { label: 'Original Invoice' },
      lineItems: true, reason: true, notes: true, totals: true,
    }, conversions: ['credit_note'],
  },
  credit_note: {
    direction: 'sales', label: 'Credit Note', partyType: 'customer', fields: {
      party: true, docNumber: true, docDate: true, referenceNumber: { label: 'Original Invoice' },
      lineItems: true, reason: true, notes: true, totals: true,
    }, conversions: [],
  },
  delivery_challan: {
    direction: 'sales', label: 'Delivery Challan', partyType: 'customer', fields: {
      party: true, docNumber: true, docDate: true, dueDate: true,
      challanType: true, placeOfSupply: true,
      lineItems: true, notes: true,
    }, conversions: ['sales_invoice'],
  },
  purchase_invoice: {
    direction: 'purchase', label: 'Purchase Invoice', partyType: 'supplier', fields: {
      party: true, docNumber: true, docDate: true, dueDate: true,
      placeOfSupply: true, lineItems: true, notes: true, totals: true, status: true,
    }, conversions: [],
  },
  payment_out: {
    direction: 'purchase', label: 'Payment Made', partyType: 'supplier', fields: {
      party: true, docNumber: true, docDate: true, paymentMode: true, paymentReference: true,
      outstandingList: true, notes: true,
    }, conversions: [],
  },
  purchase_return: {
    direction: 'purchase', label: 'Purchase Return', partyType: 'supplier', fields: {
      party: true, docNumber: true, docDate: true, referenceNumber: { label: 'Original Bill' },
      lineItems: true, reason: true, notes: true, totals: true,
    }, conversions: ['debit_note'],
  },
  debit_note: {
    direction: 'purchase', label: 'Debit Note', partyType: 'supplier', fields: {
      party: true, docNumber: true, docDate: true, referenceNumber: { label: 'Original Bill' },
      lineItems: true, reason: true, notes: true, totals: true,
    }, conversions: [],
  },
  purchase_order: {
    direction: 'purchase', label: 'Purchase Order', partyType: 'supplier', fields: {
      party: true, docNumber: true, docDate: true, dueDate: true,
      placeOfSupply: true, lineItems: true, notes: true, totals: true, status: true,
    }, conversions: ['purchase_invoice'],
  },
};
