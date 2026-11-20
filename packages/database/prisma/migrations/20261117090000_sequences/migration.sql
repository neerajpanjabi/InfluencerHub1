-- Gap-tolerant sequences for human-readable document numbers (orders, invoices, campaigns, quotations).
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 100001;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS campaign_number_seq START 10001;
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 5001;
