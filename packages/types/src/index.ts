// User & Roles
export type UserRole = 'customer' | 'merchant' | 'rider' | 'admin';

export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
  };
}

export interface GooglePhoneAuthInput {
  idToken: string;
  role?: UserRole;
  device_info?: string;
}

// Customer Profile
export interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string;
  default_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

// Merchant Profile & Operations
export type MerchantStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface MerchantProfile {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  town: string;
  service_radius_km: number;
  own_delivery_enabled: boolean;
  status: MerchantStatus;
  rating?: number;
  image_url?: string | null;
  is_open?: boolean;
  phone?: string;
  created_at: string;
}

// Rider Profile
export type RiderStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface RiderProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  vehicle_type: 'bike' | 'scooter' | 'cycle' | 'auto';
  vehicle_number: string;
  status: RiderStatus;
  online_status: boolean;
  current_latitude?: number | null;
  current_longitude?: number | null;
  last_location_update?: string | null;
  created_at: string;
}

// Product & Catalog
export interface Product {
  id: string;
  merchant_id: string;
  name: string;
  description?: string | null;
  price: number;
  category_id?: string | null;
  category_name?: string | null;
  image_key?: string | null;
  image_url?: string | null;
  active: boolean;
  is_veg?: boolean;
  in_stock?: boolean;
  created_at: string;
}

// Cart
export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export interface Cart {
  merchant_id: string;
  merchant_name: string;
  items: CartItem[];
  item_total: number;
  delivery_fee: number;
  platform_fee: number;
  grand_total: number;
}

// Orders & State Machine
export type OrderStatus =
  | 'CREATED'
  | 'MERCHANT_CONFIRMATION_PENDING'
  | 'MERCHANT_CONFIRMED'
  | 'RIDER_ASSIGNMENT_PENDING'
  | 'RIDER_ASSIGNED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'MERCHANT_REJECTED'
  | 'CUSTOMER_CANCELLED'
  | 'RIDER_CANCELLED'
  | 'PAYMENT_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FAILED';

export type DeliveryType = 'MERCHANT_SELF' | 'PLATFORM_RIDER' | 'STORE_PICKUP';

export type PaymentMethod = 'UPI' | 'COD' | 'CARD' | 'NETBANKING';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  merchant_id: string;
  merchant_name?: string;
  merchant_phone?: string;
  rider_id?: string | null;
  rider_name?: string | null;
  rider_phone?: string | null;
  delivery_type: DeliveryType;
  status: OrderStatus;
  delivery_address: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  item_total: number;
  delivery_fee: number;
  platform_fee: number;
  discount: number;
  grand_total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_otp?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

// API Responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: Record<string, any>;
}
