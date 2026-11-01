-- 0001_ilkal_seed.sql: Realistic Seed Data for Ilkal Launch Pilot

-- Insert Seed Users
INSERT OR REPLACE INTO users (id, phone, email, role, status) VALUES
  ('usr_cust_01', '9876543210', 'customer@ownlocal.live', 'customer', 'active'),
  ('usr_ayodhya', '9876543211', 'ayodhya@ownlocal.live', 'merchant', 'active'),
  ('usr_saree',   '9876543212', 'sarees@ownlocal.live',  'merchant', 'active'),
  ('usr_kirana',  '9876543213', 'kirana@ownlocal.live',  'merchant', 'active'),
  ('usr_rider_01','9876543214', 'rider@ownlocal.live',   'rider',    'active'),
  ('usr_admin_01','9876543215', 'admin@ownlocal.live',   'admin',    'active');

-- Customer Profile
INSERT OR REPLACE INTO customer_profiles (id, user_id, full_name, default_address, latitude, longitude) VALUES
  ('prof_cust_01', 'usr_cust_01', 'Ramesh Kulkarni', 'Near Vijaya Mahantesh Temple, Ilkal - 587125', 15.9592, 76.1270);

-- Categories
INSERT OR REPLACE INTO categories (id, name, slug, icon, display_order) VALUES
  ('cat_food', 'Food & Dining', 'food', 'restaurant', 1),
  ('cat_sarees', 'Ilkal Sarees & Handloom', 'sarees', 'shirt', 2),
  ('cat_kirana', 'Kirana & Daily Needs', 'kirana', 'cart', 3),
  ('cat_produce', 'Fresh Fruits & Veggies', 'produce', 'nutrition', 4),
  ('cat_medical', 'Pharmacy & Healthcare', 'medical', 'medkit', 5);

-- Merchant Profiles (Ilkal Pilot Locations)
INSERT OR REPLACE INTO merchant_profiles (id, user_id, business_name, category, phone, latitude, longitude, address, town, service_radius_km, own_delivery_enabled, rating, is_open, status) VALUES
  ('merch_ayodhya', 'usr_ayodhya', 'Ayodhya Hotel', 'Food & Dining', '9876543211', 15.9587, 76.1264, 'Main Road, Near Old Bus Stand, Ilkal', 'Ilkal', 6.0, 1, 4.8, 1, 'approved'),
  ('merch_saree', 'usr_saree', 'Ilkal Heritage Sarees', 'Ilkal Sarees & Handloom', '9876543212', 15.9601, 76.1280, 'Weavers Colony, Station Road, Ilkal', 'Ilkal', 10.0, 0, 4.9, 1, 'approved'),
  ('merch_kirana', 'usr_kirana', 'Basaveshwar Kirana Store', 'Kirana & Daily Needs', '9876543213', 15.9572, 76.1251, 'Gandhi Chowk, Ilkal', 'Ilkal', 5.0, 1, 4.6, 1, 'approved'),
  ('merch_produce', 'usr_kirana', 'Fresh Basket Ilkal', 'Fresh Fruits & Veggies', '9876543216', 15.9595, 76.1240, 'APMC Yard, Ilkal', 'Ilkal', 5.0, 0, 4.5, 1, 'approved'),
  ('merch_medical', 'usr_kirana', 'City Medical & General Store', 'Pharmacy & Healthcare', '9876543217', 15.9580, 76.1275, 'Opposite Govt Hospital, Ilkal', 'Ilkal', 7.0, 1, 4.7, 1, 'approved');

-- Products for Ayodhya Hotel
INSERT OR REPLACE INTO products (id, merchant_id, category_id, name, description, price, is_veg, in_stock, active) VALUES
  ('prod_puri', 'merch_ayodhya', 'cat_food', 'Puri Plate (3 pcs)', 'Hot fluffy puris served with spiced potato sagu and fresh coconut chutney', 50.00, 1, 1, 1),
  ('prod_dosa', 'merch_ayodhya', 'cat_food', 'Masala Dosa', 'Crisp golden crepe folded over aromatic potato palya with butter', 60.00, 1, 1, 1),
  ('prod_idli', 'merch_ayodhya', 'cat_food', 'Idli-Vada Plate', 'Two soft steamed idlis and one crispy medu vada with sambar', 45.00, 1, 1, 1),
  ('prod_coffee', 'merch_ayodhya', 'cat_food', 'Filter Coffee', 'Authentic South Indian aromatic filter kaapi brewed with fresh milk', 20.00, 1, 1, 1),
  ('prod_tea', 'merch_ayodhya', 'cat_food', 'Special Masala Tea', 'Brewed with crushed ginger, cardamom, and fresh tea leaves', 15.00, 1, 1, 1),
  ('prod_meals', 'merch_ayodhya', 'cat_food', 'North Karnataka Jowar Roti Meals', '2 Soft Jowar Rotis, Ennegai (stuffed brinjal), Shenga Chutney, Dal, Rice & Curd', 90.00, 1, 1, 1),
  ('prod_cold_drink', 'merch_ayodhya', 'cat_food', 'Cold Drink (300ml)', 'Chilled refreshing soft beverage', 30.00, 1, 1, 1);

-- Products for Ilkal Heritage Sarees
INSERT OR REPLACE INTO products (id, merchant_id, category_id, name, description, price, is_veg, in_stock, active) VALUES
  ('prod_saree_01', 'merch_saree', 'cat_sarees', 'Authentic Ilkal Silk Saree (Topetenchi Seragu)', 'Traditional red and maroon silk saree with signature handwoven pallu', 3499.00, 1, 1, 1),
  ('prod_saree_02', 'merch_saree', 'cat_sarees', 'Cotton-Silk Ilkal Daily Wear Saree', 'Lightweight comfortable saree with temple border (Paraspet)', 1299.00, 1, 1, 1);

-- Products for Basaveshwar Kirana
INSERT OR REPLACE INTO products (id, merchant_id, category_id, name, description, price, is_veg, in_stock, active) VALUES
  ('prod_kirana_01', 'merch_kirana', 'cat_kirana', 'Sona Masoori Rice (5kg Bag)', 'Premium aged polished Sona Masoori raw rice', 320.00, 1, 1, 1),
  ('prod_kirana_02', 'merch_kirana', 'cat_kirana', 'Toor Dal Premium (1kg)', 'Unpolished farm-fresh desi toor dal', 165.00, 1, 1, 1);

-- Rider Profile
INSERT OR REPLACE INTO rider_profiles (id, user_id, name, phone, vehicle_type, vehicle_number, status, online_status, current_latitude, current_longitude) VALUES
  ('rider_01', 'usr_rider_01', 'Manjunath Badiger', '9876543214', 'bike', 'KA-29-EE-4521', 'approved', 1, 15.9585, 76.1260);
