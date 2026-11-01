import {
  ApiResponse,
  MerchantProfile,
  RiderProfile,
  Product,
  Order,
  UserRole,
  AuthSession,
} from '@ownlocal/types';
import { CreateOrderInput } from '@ownlocal/validation';

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
}

export class OwnlocalApiClient {
  private baseUrl: string;
  private currentToken: string | null = null;
  private getAuthToken?: () => string | null | Promise<string | null>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
  }

  setAuthToken(token: string | null) {
    this.currentToken = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    let token = this.currentToken;
    if (!token && this.getAuthToken) {
      token = await this.getAuthToken();
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const rawText = await response.text();
      let data: any = null;
      if (rawText && rawText.trim().length > 0) {
        try {
          data = JSON.parse(rawText);
        } catch {
          // If response is not JSON (e.g. plain text or HTML 500 error from edge)
          return {
            success: false,
            error: {
              code: response.status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR',
              message: rawText.length > 200 ? `Server returned HTTP ${response.status}` : rawText,
            },
          };
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data?.error?.code || `HTTP_${response.status}`,
            message: data?.error?.message || data?.message || `Request failed with status ${response.status}`,
          },
        };
      }

      return (data || { success: true }) as ApiResponse<T>;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err?.message || 'Failed to communicate with OWNLOCAL LIVE server',
        },
      };
    }
  }

  // Health
  async getHealth(): Promise<ApiResponse<{ status: string; environment: string; timestamp: string }>> {
    return this.request('/api/health');
  }

  // Auth: Send OTP
  async sendOtp(phone: string, role: UserRole = 'customer'): Promise<ApiResponse<{ message: string; mockOtp?: string }>> {
    return this.request('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, role }),
    });
  }

  // Auth: Verify OTP
  async verifyOtp(phone: string, otp: string, role: UserRole): Promise<ApiResponse<AuthSession>> {
    const res = await this.request<AuthSession>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, role }),
    });
    if (res.success && res.data?.token) {
      this.setAuthToken(res.data.token);
    }
    return res;
  }

  // Auth: Google Phone Verification
  async loginWithGooglePhone(idToken: string, role: UserRole = 'customer'): Promise<ApiResponse<AuthSession>> {
    const res = await this.request<AuthSession>('/api/auth/google-phone', {
      method: 'POST',
      body: JSON.stringify({ idToken, role }),
    });
    if (res.success && res.data?.token) {
      this.setAuthToken(res.data.token);
    }
    return res;
  }

  // Auth: Refresh Session
  async refreshToken(refreshToken: string): Promise<ApiResponse<{ token: string }>> {
    const res = await this.request<{ token: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    if (res.success && res.data?.token) {
      this.setAuthToken(res.data.token);
    }
    return res;
  }

  // Auth: Current User Profile
  async getMe(): Promise<ApiResponse<any>> {
    return this.request('/api/auth/me');
  }

  // Auth: Logout
  async logout(): Promise<ApiResponse<{ message: string }>> {
    const res = await this.request<{ message: string }>('/api/auth/logout', { method: 'POST' });
    this.setAuthToken(null);
    return res;
  }

  // Merchants
  async getMerchants(params?: {
    category?: string;
    q?: string;
    lat?: number;
    lng?: number;
    strict_radius?: boolean;
  }): Promise<ApiResponse<MerchantProfile[]>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.lat !== undefined) searchParams.set('lat', params.lat.toString());
    if (params?.lng !== undefined) searchParams.set('lng', params.lng.toString());
    if (params?.strict_radius !== undefined) searchParams.set('strict_radius', params.strict_radius.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/merchants${query}`);
  }

  async getMerchant(id: string, params?: { lat?: number; lng?: number }): Promise<ApiResponse<MerchantProfile>> {
    const searchParams = new URLSearchParams();
    if (params?.lat !== undefined) searchParams.set('lat', params.lat.toString());
    if (params?.lng !== undefined) searchParams.set('lng', params.lng.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/merchants/${id}${query}`);
  }

  async updateMerchantDeliverySettings(
    merchantId: string,
    settings: {
      service_radius_km?: number;
      own_delivery_enabled?: boolean;
      own_delivery_radius_km?: number;
    }
  ): Promise<ApiResponse<MerchantProfile>> {
    return this.request('/api/merchant/delivery-settings', {
      method: 'POST',
      body: JSON.stringify({ merchant_id: merchantId, ...settings }),
    });
  }

  async createMerchant(merchantData: {
    business_name: string;
    category: string;
    phone: string;
    latitude: number;
    longitude: number;
    address: string;
    town?: string;
    service_radius_km?: number;
    own_delivery_enabled?: boolean;
    status?: 'approved' | 'pending';
  }): Promise<ApiResponse<MerchantProfile>> {
    return this.request('/api/merchants', {
      method: 'POST',
      body: JSON.stringify(merchantData),
    });
  }

  // Search Products Across Stores in Town
  async searchProducts(q: string, params?: { lat?: number; lng?: number }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    searchParams.set('q', q);
    if (params?.lat) searchParams.set('lat', params.lat.toString());
    if (params?.lng) searchParams.set('lng', params.lng.toString());
    return this.request(`/api/products/search?${searchParams.toString()}`);
  }

  // Products
  async getProducts(merchantId: string): Promise<ApiResponse<Product[]>> {
    return this.request(`/api/merchants/${merchantId}/products`);
  }

  // Orders
  async createOrder(orderInput: CreateOrderInput): Promise<ApiResponse<Order>> {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderInput),
    });
  }

  async getOrder(orderId: string): Promise<ApiResponse<Order>> {
    return this.request(`/api/orders/${orderId}`);
  }

  async updateOrderStatus(orderId: string, status: string, notes?: string): Promise<ApiResponse<Order>> {
    return this.request(`/api/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  }

  async getCustomerOrders(customerId?: string): Promise<ApiResponse<Order[]>> {
    const query = customerId ? `?customer_id=${customerId}` : '';
    return this.request(`/api/customer/orders${query}`);
  }

  async verifyDeliveryOtp(orderId: string, otp: string): Promise<ApiResponse<{ id: string; status: string; verified: boolean }>> {
    return this.request(`/api/orders/${orderId}/verify-delivery`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  }

  async cancelOrder(orderId: string, reason?: string): Promise<ApiResponse<{ id: string; status: string }>> {
    return this.request(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // RBAC Protected Role Endpoints
  async getMerchantDashboard(merchantId?: string): Promise<ApiResponse<{ merchant: any; orders: any[]; metrics: any }>> {
    const query = merchantId ? `?merchant_id=${merchantId}` : '';
    return this.request(`/api/merchant/dashboard${query}`);
  }

  async toggleMerchantOpen(isOpen: boolean, merchantId?: string): Promise<ApiResponse<any>> {
    return this.request('/api/merchant/toggle-open', {
      method: 'POST',
      body: JSON.stringify({ is_open: isOpen, merchant_id: merchantId }),
    });
  }

  async toggleProductStock(productId: string, inStock: boolean): Promise<ApiResponse<any>> {
    return this.request(`/api/merchant/products/${productId}/toggle-stock`, {
      method: 'POST',
      body: JSON.stringify({ in_stock: inStock }),
    });
  }

  async createMerchantProduct(data: {
    merchant_id?: string;
    name: string;
    description?: string;
    price: number;
    is_veg?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request('/api/merchant/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMerchantProduct(productId: string, data: {
    name?: string;
    description?: string;
    price?: number;
    is_veg?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request(`/api/merchant/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMerchantProduct(productId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/merchant/products/${productId}`, {
      method: 'DELETE',
    });
  }

  async getRiderConsole(riderId?: string): Promise<ApiResponse<{
    rider: any;
    activeJob: any;
    availableJobs: any[];
    metrics: any;
    dispatch_settings?: {
      effective_radius_km: number;
      rider_preferred_radius_km?: number | null;
      admin_platform_radius_km: number;
      is_online: boolean;
      is_approved: boolean;
    };
    offline_notice?: string | null;
  }>> {
    const query = riderId ? `?rider_id=${riderId}` : '';
    return this.request(`/api/rider/console${query}`);
  }

  async riderAcceptJob(orderId: string, riderId?: string): Promise<ApiResponse<any>> {
    return this.request('/api/rider/accept-job', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, rider_id: riderId }),
    });
  }

  async registerRider(data: {
    name: string;
    phone: string;
    vehicle_type?: 'bike' | 'scooter' | 'cycle' | 'auto';
    vehicle_number: string;
    preferred_radius_km?: number;
  }): Promise<ApiResponse<RiderProfile>> {
    return this.request('/api/riders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async riderPickupJob(orderId: string): Promise<ApiResponse<any>> {
    return this.request('/api/rider/pickup-job', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId }),
    });
  }

  async riderToggleDuty(online: boolean, riderId?: string): Promise<ApiResponse<any>> {
    return this.request('/api/rider/toggle-duty', {
      method: 'POST',
      body: JSON.stringify({ online, rider_id: riderId }),
    });
  }

  async riderUpdateLocation(latitude: number, longitude: number, riderId?: string): Promise<ApiResponse<any>> {
    return this.request('/api/rider/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, rider_id: riderId }),
    });
  }

  async updateRiderSettings(preferredRadiusKm: number, riderId?: string): Promise<ApiResponse<any>> {
    return this.request('/api/rider/settings', {
      method: 'POST',
      body: JSON.stringify({ preferred_radius_km: preferredRadiusKm, rider_id: riderId }),
    });
  }

  async getPlatformSettings(): Promise<ApiResponse<{ platform_rider_matching_radius_km: number; settings: Record<string, any> }>> {
    return this.request('/api/admin/settings');
  }

  async updatePlatformSettings(settings: { platform_rider_matching_radius_km?: number }): Promise<ApiResponse<{ platform_rider_matching_radius_km: number }>> {
    return this.request('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async getAdminMetrics(): Promise<ApiResponse<any>> {
    return this.request('/api/admin/metrics');
  }

  async getAdminMerchants(): Promise<ApiResponse<MerchantProfile[]>> {
    return this.request('/api/admin/merchants');
  }

  async updateAdminMerchantStatus(id: string, status: string): Promise<ApiResponse<any>> {
    return this.request(`/api/admin/merchants/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteAdminMerchant(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/admin/merchants/${id}`, {
      method: 'DELETE',
    });
  }

  async getAdminRiders(): Promise<ApiResponse<RiderProfile[]>> {
    return this.request('/api/admin/riders');
  }

  async updateAdminRiderStatus(id: string, status: string): Promise<ApiResponse<any>> {
    return this.request(`/api/admin/riders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteAdminRider(id: string): Promise<ApiResponse<any>> {
    return this.request(`/api/admin/riders/${id}`, {
      method: 'DELETE',
    });
  }

  async getAdminOrders(): Promise<ApiResponse<any[]>> {
    return this.request('/api/admin/orders');
  }

  // Cloudflare R2 Media Storage
  async uploadAsset(file: any, filename: string): Promise<ApiResponse<{ key: string; filename: string; contentType: string; size: number; url: string }>> {
    const formData = new FormData();
    formData.append('file', file, filename);

    return this.request('/api/assets/upload', {
      method: 'POST',
      body: formData,
    });
  }

  getAssetUrl(key: string): string {
    return `${this.baseUrl}/api/assets/${key}`;
  }

  async registerPushToken(payload: {
    token: string;
    userId?: string;
    role?: string;
    merchantId?: string;
    riderId?: string;
  }): Promise<ApiResponse<{ registered: boolean }>> {
    return this.request('/api/notifications/register-token', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
