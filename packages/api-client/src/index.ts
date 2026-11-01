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
  async getMerchants(params?: { category?: string; lat?: number; lng?: number }): Promise<ApiResponse<MerchantProfile[]>> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.lat) searchParams.set('lat', params.lat.toString());
    if (params?.lng) searchParams.set('lng', params.lng.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/merchants${query}`);
  }

  async getMerchant(id: string): Promise<ApiResponse<MerchantProfile>> {
    return this.request(`/api/merchants/${id}`);
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

  // RBAC Protected Role Endpoints
  async getMerchantDashboard(): Promise<ApiResponse<{ merchant: any; orders: any[] }>> {
    return this.request('/api/merchant/dashboard');
  }

  async getRiderActiveJob(): Promise<ApiResponse<{ rider: any; activeJob: any }>> {
    return this.request('/api/rider/active-job');
  }

  async getAdminMetrics(): Promise<ApiResponse<any>> {
    return this.request('/api/admin/metrics');
  }
}
