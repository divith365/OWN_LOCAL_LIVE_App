import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, AuthSession } from '@ownlocal/types';
import { apiClient } from '../api';

interface AuthContextType {
  user: any | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithOtp: (phone: string, otp: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  loginWithGooglePhone: (idToken: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  loginWithOtp: async () => ({ success: false }),
  loginWithGooglePhone: async () => ({ success: false }),
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and check current session
  useEffect(() => {
    // Check if there is an active session
    setIsLoading(false);
  }, []);

  const handleSessionSuccess = (session: AuthSession) => {
    setToken(session.token);
    setUser(session.user);
    setRole(session.user.role);
    apiClient.setAuthToken(session.token);
  };

  const loginWithOtp = async (phone: string, otp: string, selectedRole: UserRole) => {
    try {
      const res = await apiClient.verifyOtp(phone, otp, selectedRole);
      if (res.success && res.data) {
        handleSessionSuccess(res.data);
        return { success: true };
      }
      return { success: false, error: res.error?.message || 'Login failed' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error during login' };
    }
  };

  const loginWithGooglePhone = async (idToken: string, selectedRole: UserRole) => {
    try {
      const res = await apiClient.loginWithGooglePhone(idToken, selectedRole);
      if (res.success && res.data) {
        handleSessionSuccess(res.data);
        return { success: true };
      }
      return { success: false, error: res.error?.message || 'Google verification failed' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      setToken(null);
      setRole(null);
      apiClient.setAuthToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isAuthenticated: !!token,
        isLoading,
        loginWithOtp,
        loginWithGooglePhone,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
