import { z } from 'zod';

// Phone OTP Auth Schema
export const SendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  role: z.enum(['customer', 'merchant', 'rider', 'admin']).default('customer'),
});

export const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  role: z.enum(['customer', 'merchant', 'rider', 'admin']),
});

export const GooglePhoneAuthSchema = z.object({
  idToken: z.string().min(10, 'Google ID token required'),
  role: z.enum(['customer', 'merchant', 'rider', 'admin']).default('customer'),
  device_info: z.string().optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token required'),
});

// Location / Address Schema
export const AddressSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  address_line: z.string().min(5, 'Address is too short'),
  landmark: z.string().optional(),
  town: z.string().default('Ilkal'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Create Order Schema
export const CreateOrderItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive(),
  notes: z.string().max(200).optional(),
});

export const CreateOrderSchema = z.object({
  merchant_id: z.string().min(1),
  items: z.array(CreateOrderItemSchema).min(1, 'Order must contain at least 1 item'),
  delivery_type: z.enum(['MERCHANT_SELF', 'PLATFORM_RIDER', 'STORE_PICKUP']),
  delivery_address: z.string().min(5),
  delivery_latitude: z.number().optional(),
  delivery_longitude: z.number().optional(),
  payment_method: z.enum(['UPI', 'COD', 'CARD', 'NETBANKING']),
});

// Rider Location Ping Schema
export const RiderLocationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

export type SendOtpInput = z.infer<typeof SendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type RiderLocationUpdateInput = z.infer<typeof RiderLocationUpdateSchema>;
