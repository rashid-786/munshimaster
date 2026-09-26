-- Seed marketplace templates with rich configs for each category

-- UUIDs generated for reproducibility, using a deterministic pattern
-- Helper: gen_random_uuid() available in pg

-- ========== General Business (id=1) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 1,
  'Modern Business',
  'Clean, professional design with navy accents. Perfect for general trading and services.',
  '{invoice,quotation,credit_note}',
  '{"defaultTemplate": "modern", "primaryColor": "#1E3A5F", "secondaryColor": "#2E7D32", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "left", "headerBackground": "#FFFFFF", "footerBackground": "#F1F5F9", "fontFamily": "Helvetica", "fontSize": "medium", "headerHeight": 130, "logoSize": 90, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "INVOICE", "invoiceNumber": "Invoice #", "invoiceDate": "Date", "dueDate": "Due Date", "billTo": "Bill To", "subtotal": "Subtotal", "grandTotal": "Grand Total", "amountInWords": "Amount in Words"}}',
  NULL
),
(
  gen_random_uuid(), 1,
  'Classic Corporate',
  'Traditional dark header with gold accents. Formal look for established businesses.',
  '{invoice,purchase_invoice,debit_note}',
  '{"defaultTemplate": "classic", "primaryColor": "#1B1B2F", "secondaryColor": "#D4A017", "logoAlignment": "center", "companyInfoPosition": "center", "customerLayout": "two_column", "headerBackground": "#1B1B2F", "footerBackground": "#FAFAFA", "fontFamily": "Times-Roman", "fontSize": "small", "headerHeight": 140, "logoSize": 75, "pageMargin": 55, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": false, "showAmountInWords": true, "customLabels": {"invoice": "TAX INVOICE", "invoiceNumber": "Invoice No.", "invoiceDate": "Issue Date", "dueDate": "Due On", "billTo": "Customer", "subtotal": "Sub Total", "grandTotal": "Total Due", "amountInWords": "Rupees in Words"}}',
  NULL
),
(
  gen_random_uuid(), 1,
  'Minimal Clean',
  'Simple, minimal design with lots of white space. Great for freelancers and consultants.',
  '{invoice,estimate}',
  '{"defaultTemplate": "minimal", "primaryColor": "#374151", "secondaryColor": "#059669", "logoAlignment": "right", "companyInfoPosition": "right", "customerLayout": "right", "headerBackground": "#FFFFFF", "footerBackground": "#FFFFFF", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 100, "logoSize": 70, "pageMargin": 60, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": false, "showGstBreakdown": true, "showRoundOff": false, "showAmountInWords": false, "customLabels": {"invoice": "INVOICE", "invoiceNumber": "Inv #", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Client", "subtotal": "Total", "grandTotal": "Amount Due"}}',
  NULL
);

-- ========== Restaurant (id=2) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 2,
  'Bistro Classic',
  'Warm tones with an amber accent — designed for restaurants and cafes.',
  '{invoice,quotation}',
  '{"defaultTemplate": "modern", "primaryColor": "#5D4037", "secondaryColor": "#F57C00", "logoAlignment": "center", "companyInfoPosition": "center", "customerLayout": "left", "headerBackground": "#FFF8E1", "footerBackground": "#FFF3E0", "fontFamily": "Times-Roman", "fontSize": "medium", "headerHeight": 120, "logoSize": 85, "pageMargin": 45, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": false, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": false, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "RESTAURANT BILL", "invoiceNumber": "Bill No.", "invoiceDate": "Date", "dueDate": "", "billTo": "Table / Guest", "subtotal": "Subtotal", "grandTotal": "Total", "amountInWords": "Amount in Words"}}',
  NULL
),
(
  gen_random_uuid(), 2,
  'Foodie Fresh',
  'Bright green and white — modern casual dining aesthetic with vegan-friendly vibe.',
  '{invoice}',
  '{"defaultTemplate": "modern", "primaryColor": "#2E7D32", "secondaryColor": "#FF6F00", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "left", "headerBackground": "#E8F5E9", "footerBackground": "#F1F8E9", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 110, "logoSize": 80, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "FOOD BILL", "invoiceNumber": "Bill #", "invoiceDate": "Date", "dueDate": "Pay By", "billTo": "Customer", "subtotal": "Sub Total", "grandTotal": "Grand Total"}}',
  NULL
);

-- ========== Pharmacy (id=3) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 3,
  'Pharma Pro',
  'Professional green-blue scheme with clear itemized drug details. DGDA compliant layout.',
  '{invoice,delivery_challan}',
  '{"defaultTemplate": "modern", "primaryColor": "#00695C", "secondaryColor": "#00897B", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "left", "headerBackground": "#E0F2F1", "footerBackground": "#F5F5F5", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 120, "logoSize": 80, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "PHARMACY INVOICE", "invoiceNumber": "Rx No.", "invoiceDate": "Date", "dueDate": "Expiry", "billTo": "Patient / Customer", "subtotal": "Subtotal", "grandTotal": "Total", "amountInWords": "In Words"}}',
  NULL
),
(
  gen_random_uuid(), 3,
  'Health Care',
  'Clean white and teal design with emphasis on batch/lot tracking for pharmaceutical products.',
  '{invoice,purchase_invoice}',
  '{"defaultTemplate": "classic", "primaryColor": "#0D47A1", "secondaryColor": "#00BCD4", "logoAlignment": "left", "companyInfoPosition": "right", "customerLayout": "two_column", "headerBackground": "#FFFFFF", "footerBackground": "#E3F2FD", "fontFamily": "Courier", "fontSize": "small", "headerHeight": 130, "logoSize": 75, "pageMargin": 45, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": false, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "MEDICAL BILL", "invoiceNumber": "Bill #", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Patient", "subtotal": "Total", "grandTotal": "Grand Total"}}',
  NULL
);

-- ========== Garments (id=4) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 4,
  'Fashionista',
  'Elegant pink-rose theme for boutiques and garment showrooms.',
  '{invoice,quotation}',
  '{"defaultTemplate": "modern", "primaryColor": "#880E4F", "secondaryColor": "#D81B60", "logoAlignment": "center", "companyInfoPosition": "right", "customerLayout": "right", "headerBackground": "#FCE4EC", "footerBackground": "#FFF0F5", "fontFamily": "Times-Roman", "fontSize": "medium", "headerHeight": 120, "logoSize": 90, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "INVOICE", "invoiceNumber": "Invoice #", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Buyer", "subtotal": "Subtotal", "grandTotal": "Grand Total", "amountInWords": "In Words"}}',
  NULL
),
(
  gen_random_uuid(), 4,
  'Textile Trader',
  'Professional indigo design optimized for textile wholesale and fabric merchants.',
  '{invoice,purchase_order}',
  '{"defaultTemplate": "classic", "primaryColor": "#1A237E", "secondaryColor": "#FF6F00", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "two_column", "headerBackground": "#E8EAF6", "footerBackground": "#F5F5F5", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 130, "logoSize": 80, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": false, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "TAX INVOICE", "invoiceNumber": "L.R. No.", "invoiceDate": "Date", "dueDate": "Due On", "billTo": "Purchaser", "subtotal": "Total Before Tax", "grandTotal": "Grand Total"}}',
  NULL
);

-- ========== Electronics (id=5) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 5,
  'Tech Blue',
  'Modern blue gradient design for electronics & mobile retailers.',
  '{invoice,delivery_challan,quotation}',
  '{"defaultTemplate": "modern", "primaryColor": "#0D47A1", "secondaryColor": "#1976D2", "logoAlignment": "right", "companyInfoPosition": "right", "customerLayout": "left", "headerBackground": "#E3F2FD", "footerBackground": "#F5F5F5", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 120, "logoSize": 80, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "SALES INVOICE", "invoiceNumber": "Invoice #", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Customer", "subtotal": "Subtotal", "grandTotal": "Grand Total", "amountInWords": "Rupees in Words"}}',
  NULL
),
(
  gen_random_uuid(), 5,
  'Gadget Gear',
  'Sleek dark theme with electric blue accents — bold look for electronics brands.',
  '{invoice}',
  '{"defaultTemplate": "modern", "primaryColor": "#212121", "secondaryColor": "#2979FF", "logoAlignment": "center", "companyInfoPosition": "center", "customerLayout": "left", "headerBackground": "#212121", "footerBackground": "#FAFAFA", "fontFamily": "Helvetica", "fontSize": "medium", "headerHeight": 140, "logoSize": 85, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "INVOICE", "invoiceNumber": "Order No.", "invoiceDate": "Date", "dueDate": "Pay By", "billTo": "Sold To", "subtotal": "Subtotal", "grandTotal": "TOTAL"}}',
  NULL
);

-- ========== Wholesale (id=6) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 6,
  'Wholesale Pro',
  'High-density layout optimized for bulk item listings. Perfect for distributors.',
  '{invoice,purchase_order,delivery_challan}',
  '{"defaultTemplate": "modern", "primaryColor": "#263238", "secondaryColor": "#FF8F00", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "two_column", "headerBackground": "#ECEFF1", "footerBackground": "#F5F5F5", "fontFamily": "Courier", "fontSize": "small", "headerHeight": 110, "logoSize": 75, "pageMargin": 40, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": false, "showAmountInWords": true, "customLabels": {"invoice": "WHOLESALE INVOICE", "invoiceNumber": "Invoice No.", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Party", "subtotal": "Total", "grandTotal": "Grand Total", "amountInWords": "Amount in Words"}}',
  NULL
),
(
  gen_random_uuid(), 6,
  'Bulk Bazaar',
  'Compact monospace layout for high-volume transactions. Efficient use of page space.',
  '{invoice,purchase_invoice}',
  '{"defaultTemplate": "minimal", "primaryColor": "#3E2723", "secondaryColor": "#6D4C41", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "left", "headerBackground": "#EFEBE9", "footerBackground": "#FAFAFA", "fontFamily": "Courier", "fontSize": "small", "headerHeight": 100, "logoSize": 70, "pageMargin": 35, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": false, "showRoundOff": false, "showAmountInWords": false, "customLabels": {"invoice": "BILL", "invoiceNumber": "Bill No.", "invoiceDate": "Dt.", "dueDate": "Due", "billTo": "Customer", "subtotal": "Sub", "grandTotal": "Grand Total"}}',
  NULL
);

-- ========== Service Business (id=7) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 7,
  'Consultant Bright',
  'Light, airy design with purple tones — perfect for consultants, agencies, and professionals.',
  '{invoice,estimate,quotation}',
  '{"defaultTemplate": "modern", "primaryColor": "#4A148C", "secondaryColor": "#7B1FA2", "logoAlignment": "right", "companyInfoPosition": "right", "customerLayout": "left", "headerBackground": "#F3E5F5", "footerBackground": "#F5F5F5", "fontFamily": "Helvetica", "fontSize": "medium", "headerHeight": 120, "logoSize": 80, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "PROFESSIONAL INVOICE", "invoiceNumber": "Ref #", "invoiceDate": "Date", "dueDate": "Terms", "billTo": "Client", "subtotal": "Professional Fees", "grandTotal": "Total Due", "amountInWords": "In Words"}}',
  NULL
),
(
  gen_random_uuid(), 7,
  'Agency Dark',
  'Modern dark mode design with vibrant cyan — stands out for creative agencies.',
  '{invoice,credit_note}',
  '{"defaultTemplate": "modern", "primaryColor": "#0D0D0D", "secondaryColor": "#00E5FF", "logoAlignment": "center", "companyInfoPosition": "center", "customerLayout": "two_column", "headerBackground": "#0D0D0D", "footerBackground": "#1A1A1A", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 130, "logoSize": 90, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": false, "showRoundOff": false, "showAmountInWords": true, "customLabels": {"invoice": "INVOICE", "invoiceNumber": "#", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Client", "subtotal": "Subtotal", "grandTotal": "TOTAL"}}',
  NULL
);

-- ========== Retail (id=8) ==========
INSERT INTO hris_saas.marketplace_templates (id, category_id, name, description, document_types, config, thumbnail_url) VALUES
(
  gen_random_uuid(), 8,
  'Retail Ready',
  'Warm and inviting design with coral accents. Great for general retail stores.',
  '{invoice,delivery_challan}',
  '{"defaultTemplate": "modern", "primaryColor": "#BF360C", "secondaryColor": "#E64A19", "logoAlignment": "left", "companyInfoPosition": "left", "customerLayout": "left", "headerBackground": "#FBE9E7", "footerBackground": "#FFF3E0", "fontFamily": "Helvetica", "fontSize": "medium", "headerHeight": 120, "logoSize": 80, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": true, "showPaymentTerms": true, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "RETAIL INVOICE", "invoiceNumber": "Bill #", "invoiceDate": "Date", "dueDate": "Due", "billTo": "Customer", "subtotal": "Total", "grandTotal": "Grand Total", "amountInWords": "In Words"}}',
  NULL
),
(
  gen_random_uuid(), 8,
  'ShopKeeper Classic',
  'Traditional green header design familiar to Indian kirana and general stores.',
  '{invoice}',
  '{"defaultTemplate": "classic", "primaryColor": "#1B5E20", "secondaryColor": "#F9A825", "logoAlignment": "center", "companyInfoPosition": "center", "customerLayout": "left", "headerBackground": "#1B5E20", "footerBackground": "#F1F8E9", "fontFamily": "Courier", "fontSize": "small", "headerHeight": 130, "logoSize": 75, "pageMargin": 45, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": false, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": false, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "BILL", "invoiceNumber": "Bill No.", "invoiceDate": "Date", "dueDate": "", "billTo": "Customer", "subtotal": "Subtotal", "grandTotal": "Total"}}',
  NULL
),
(
  gen_random_uuid(), 8,
  'SuperMarket Saver',
  'Bright orange-yellow palette optimized for supermarket and grocery chains.',
  '{invoice,credit_note}',
  '{"defaultTemplate": "modern", "primaryColor": "#E65100", "secondaryColor": "#FFB300", "logoAlignment": "left", "companyInfoPosition": "right", "customerLayout": "two_column", "headerBackground": "#FFF3E0", "footerBackground": "#FFF8E1", "fontFamily": "Helvetica", "fontSize": "small", "headerHeight": 115, "logoSize": 85, "pageMargin": 50, "showInvoiceNo": true, "showInvoiceDate": true, "showDueDate": false, "showPaymentTerms": false, "showDiscountTotal": true, "showGstBreakdown": true, "showRoundOff": true, "showAmountInWords": true, "customLabels": {"invoice": "SALES BILL", "invoiceNumber": "Bill No.", "invoiceDate": "Date", "dueDate": "", "billTo": "Buyer", "subtotal": "Subtotal", "grandTotal": "Grand Total", "amountInWords": "In Words"}}',
  NULL
);
