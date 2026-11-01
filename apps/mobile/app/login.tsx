import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { UserRole } from '@ownlocal/types';
import { useAuth } from '../src/context/AuthContext';
import { apiClient } from '../src/api';

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginWithGooglePhone } = useAuth();

  const [phone, setPhone] = useState('9876543210');
  const [role, setRole] = useState<UserRole>('customer');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('123456');
  const [loading, setLoading] = useState(false);

  const roles: Array<{ id: UserRole; label: string; icon: string }> = [
    { id: 'customer', label: 'Customer', icon: '🛍️' },
    { id: 'merchant', label: 'Merchant', icon: '🏪' },
    { id: 'rider', label: 'Rider', icon: '🛵' },
    { id: 'admin', label: 'Admin', icon: '🛡️' },
  ];

  const handleQuickSeed = (seedPhone: string, seedRole: UserRole) => {
    setPhone(seedPhone);
    setRole(seedRole);
  };

  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.sendOtp(phone, role);
      if (res.success) {
        setOtpSent(true);
        if (res.data?.mockOtp) {
          setOtp(res.data.mockOtp);
        }
        Alert.alert('OTP Sent', res.data?.message || 'Code sent successfully');
      } else {
        Alert.alert('Error', res.error?.message || 'Could not send OTP');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a 6-digit verification code');
      return;
    }
    setLoading(true);
    const result = await loginWithOtp(phone, otp, role);
    setLoading(false);

    if (result.success) {
      Alert.alert('Authenticated', `Signed in as ${role.toUpperCase()}`);
      // Route to destination
      if (role === 'customer') router.replace('/(customer)');
      else if (role === 'merchant') router.replace('/(merchant)');
      else if (role === 'rider') router.replace('/(rider)');
      else if (role === 'admin') router.replace('/(admin)');
    } else {
      Alert.alert('Verification Failed', result.error || 'Invalid OTP code');
    }
  };

  const handleGooglePhoneDemo = async () => {
    setLoading(true);
    // Simulates Google Identity Phone Token payload: eyJhbGciOiJSUzI1NiJ9.eyJwaG9uZV9udW1iZXIiOiIrOTE5ODc2NTQzMjEwIiwic3ViIjoiZ29vZ2xlXzEyMzQ1In0...
    const mockGoogleIdToken =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJwaG9uZV9udW1iZXIiOiIrOTEt' +
      btoa(phone) +
      'Iiwic3ViIjoiZ29vZ2xlX3VzZXJfOTA5MCJ9.mock_google_signature';

    const result = await loginWithGooglePhone(mockGoogleIdToken, role);
    setLoading(false);

    if (result.success) {
      Alert.alert('Google Phone Verified', `Verified via Google Identity for ${phone}`);
      if (role === 'customer') router.replace('/(customer)');
      else if (role === 'merchant') router.replace('/(merchant)');
      else if (role === 'rider') router.replace('/(rider)');
      else if (role === 'admin') router.replace('/(admin)');
    } else {
      Alert.alert('Error', result.error || 'Google Phone verification failed');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>⚡</Text>
        <Text style={styles.title}>OWNLOCAL LIVE</Text>
        <Text style={styles.subtitle}>Secure Phone OTP & Google Auth • Ilkal</Text>
      </View>

      {/* Role Selection */}
      <Text style={styles.label}>Select Your Role</Text>
      <View style={styles.roleGrid}>
        {roles.map((r) => {
          const isSelected = role === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.roleChip, isSelected && styles.roleChipSelected]}
              onPress={() => setRole(r.id)}
            >
              <Text style={styles.roleIcon}>{r.icon}</Text>
              <Text style={[styles.roleLabel, isSelected && styles.roleLabelSelected]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quick Seed Buttons */}
      <View style={styles.seedRow}>
        <Text style={styles.seedTitle}>Quick Fill:</Text>
        <TouchableOpacity
          style={styles.seedBtn}
          onPress={() => handleQuickSeed('9876543210', 'customer')}
        >
          <Text style={styles.seedBtnText}>Ramesh (Customer)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.seedBtn}
          onPress={() => handleQuickSeed('9876543211', 'merchant')}
        >
          <Text style={styles.seedBtnText}>Ayodhya (Merchant)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.seedBtn}
          onPress={() => handleQuickSeed('9876543214', 'rider')}
        >
          <Text style={styles.seedBtnText}>KA-29 (Rider)</Text>
        </TouchableOpacity>
      </View>

      {/* Phone Number Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Mobile Number</Text>
        <View style={styles.phoneInputRow}>
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>🇮🇳 +91</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="10-digit number"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>
      </View>

      {/* OTP Input (Shown when OTP sent or in dev mode) */}
      {otpSent && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Enter 6-digit OTP Code</Text>
          <TextInput
            style={styles.otpInput}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
          <Text style={styles.otpHint}>Code valid for 5 minutes. (Dev code: 123456)</Text>
        </View>
      )}

      {/* Action Buttons */}
      {!otpSent ? (
        <TouchableOpacity
          style={styles.primaryBtn}
          disabled={loading}
          onPress={handleSendOtp}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Send OTP Verification Code →</Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={loading}
            onPress={handleVerify}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Verify & Continue →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} onPress={handleSendOtp}>
            <Text style={styles.resendBtnText}>Resend OTP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Google Phone Auth Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR SIGN IN WITH</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Google Phone Auth Button */}
      <TouchableOpacity
        style={styles.googleBtn}
        disabled={loading}
        onPress={handleGooglePhoneDemo}
      >
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleBtnText}>Verify Phone with Google Identity</Text>
      </TouchableOpacity>

      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back to Role Switcher</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  logo: {
    fontSize: 40,
  },
  title: {
    ...Typography.title1,
    color: Colors.slate900,
    marginTop: 4,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 4,
  },
  label: {
    ...Typography.subheadBold,
    color: Colors.slate800,
    marginBottom: 8,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleChipSelected: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  roleIcon: {
    fontSize: 18,
  },
  roleLabel: {
    ...Typography.caption,
    color: Colors.slate700,
    marginTop: 4,
  },
  roleLabelSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  seedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  seedTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  seedBtn: {
    backgroundColor: Colors.slate200,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  seedBtnText: {
    fontSize: 11,
    color: Colors.slate800,
    fontWeight: '600',
  },
  inputGroup: {
    marginTop: 4,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  prefixBox: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  prefixText: {
    ...Typography.bodyBold,
    color: Colors.slate800,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Typography.bodyBold,
    fontSize: 16,
    color: Colors.slate900,
  },
  otpInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Typography.title2,
    textAlign: 'center',
    letterSpacing: 8,
    color: Colors.primaryDark,
  },
  otpHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontSize: 15,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendBtnText: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    paddingHorizontal: 12,
    fontWeight: '600',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    ...Typography.bodyBold,
    color: Colors.slate800,
    fontSize: 14,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backBtnText: {
    ...Typography.subhead,
    color: Colors.textMuted,
  },
});
