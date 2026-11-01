-- 0003_merchant_delivery_radius.sql: Support merchant self-delivery radius configuration
ALTER TABLE merchant_profiles ADD COLUMN own_delivery_radius_km REAL DEFAULT 3.0;
