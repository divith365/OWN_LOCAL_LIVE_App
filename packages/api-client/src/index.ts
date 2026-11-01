import {
  ApiResponse,
  MerchantProfile,
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

      const data = await response.json();
      return data as ApiResponse<T>;
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
  async getMerchants(params?: { category?: string; q?: string; lat?: number; lng?: number }): Promise<ApiResponse<MerchantProfile[]>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.q) searchParams.set('q', params.q);
    if (params?.lat) searchParams.set('lat', params.lat.toString());
    if (params?.lng) searchParams.set('lng', params.lng.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/merchants${query}`);
  }

  async getMerchant(id: string): Promise<ApiResponse<MerchantProfile>> {
    return this.request(`/api/merchants/${id}`);
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

  async getRiderConsole(riderId?: string): Promise<ApiResponse<{ rider: any; activeJob: any; availableJobs: any[]; metrics: any }>> {
    const query = riderId ? `?rider_id=${riderId}` : '';
    return this.request(`/api/rider/console${query}`);
  }

  async riderAcceptJob(orderId: string, riderId?: string): Promise<ApiResponse<any>> {
    return this.request('/api/rider/accept-job', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, rider_id: riderId }),
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

  async getAdminMetrics(): Promise<ApiResponse<any>> {
    return this.request('/api/admin/metrics');
  }
}
