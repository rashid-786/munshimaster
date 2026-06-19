ALTER TABLE tenants ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'free' AFTER subdomain;
ALTER TABLE tenants ADD COLUMN phone VARCHAR(50) DEFAULT NULL AFTER subscription_plan;
