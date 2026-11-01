-- 0001_initial_schema.sql: OWNLOCAL LIVE Core Tables

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK(role IN ('customer', 'merchant', 'rider', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Customer Profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  default_address TEXT,
  latitude REAL,
  longitude REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Merchant Profiles
CREATE TABLE IF NOT EXISTS merchant_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  phone TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT NOT NULL,
  town TEXT NOT NULL DEFAULT 'Ilkal',
  service_radius_km REAL NOT NULL DEFAULT 5.0,
  own_delivery_enabled INTEGER NOT NULL DEFAULT 0,
  rating REAL DEFAULT 4.5,
  image_url TEXT,
  is_open INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Rider Profiles
CREATE TABLE IF NOT EXISTS rider_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK(vehicle_type IN ('bike', 'scooter', 'cycle', 'auto')),
  vehicle_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected', 'suspended')),
  online_status INTEGER NOT NULL DEFAULT 0,
  current_latitude REAL,
  current_longitude REAL,
  last_location_update TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0
);

-- 6. Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchant_profiles(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image_key TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  is_veg INTEGER DEFAULT 1,
  in_stock INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT NOT NULL REFERENCES users(id),
  merchant_id TEXT NOT NULL REFERENCES merchant_profiles(id),
  rider_id TEXT REFERENCES rider_profiles(id),
  delivery_type TEXT NOT NULL CHECK(delivery_type IN ('MERCHANT_SELF', 'PLATFORM_RIDER', 'STORE_PICKUP')),
  status TEXT NOT NULL DEFAULT 'CREATED',
  delivery_address TEXT NOT NULL,
  delivery_latitude REAL,
  delivery_longitude REAL,
  item_total REAL NOT NULL,
  delivery_fee REAL NOT NULL DEFAULT 0,
  platform_fee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('UPI', 'COD', 'CARD', 'NETBANKING')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
  delivery_otp TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  total_price REAL NOT NULL
);

-- 9. Order Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Rider Locations Log
CREATE TABLE IF NOT EXISTS rider_locations (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES rider_profiles(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  heading REAL,
  speed REAL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indices for Fast Queries
CREATE INDEX IF NOT EXISTS idx_merchant_location ON merchant_profiles(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
