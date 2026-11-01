-- 0004_rider_dispatch_radius.sql
-- Add preferred matching radius for riders and platform global configuration

ALTER TABLE rider_profiles ADD COLUMN preferred_radius_km REAL DEFAULT 3.0;

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO platform_settings (key, value, description)
VALUES ('platform_rider_matching_radius_km', '3.0', 'Default platform matching radius in km between Merchant pickup location and Rider current GPS location');
