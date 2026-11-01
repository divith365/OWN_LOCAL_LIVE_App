import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const demoRoles: Array<{
    id: UserRole;
    label: string;
    phone: string;
    desc: string;
    icon: string;
  }> = [
    { id: 'customer', label: 'Customer', phone: '9876543210', desc: 'Ananya • Shopper', icon: '🛍️' },
    { id: 'merchant', label: 'Merchant', phone: '9876543211', desc: 'Ayodhya Hotel', icon: '🏪' },
    { id: 'rider', label: 'Rider', phone: '9876543214', desc: 'Ravi K. (KA-29)', icon: '🛵' },
    { id: 'admin', label: 'Admin', phone: '9876543219', desc: 'Pilot Launch Admin', icon: '🛡️' },
  ];

  const handleSelectRole = (r: (typeof demoRoles)[0]) => {
    setRole(r.id);
    setPhone(r.phone);
    setOtp('123456');
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
        Alert.alert('OTP Sent', res.data?.message || 'Verification code sent successfully');
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
    <SafeAreaView style={styles.safeArea}>
      {/* 4px Dual-Gradient Topline matching POC */}
      <View style={styles.topline}>
        <View style={styles.toplineCyan} />
        <View style={styles.toplineOrange} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Official Brand Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Login Card styled after POC */}
        <View style={styles.loginCard}>
          <Text style={styles.eyebrow}>ILKAL PILOT • PROOF OF CONCEPT</Text>
          <Text style={styles.title}>Explore the marketplace</Text>
          <Text style={styles.subtitle}>
            Choose a demo role. Credentials are prefilled so you can walk through every side of the marketplace.
          </Text>

          {/* 2x2 Demo Role Quick-Fill Grid */}
          <Text style={styles.gridHeading}>SELECT DEMO PERSONA</Text>
          <View style={styles.credGrid}>
            {demoRoles.map((r) => {
              const isSelected = role === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.credBtn, isSelected && styles.credBtnSelected]}
                  onPress={() => handleSelectRole(r)}
                  activeOpacity={0.8}
                >
                  <View style={styles.credBtnHeader}>
                    <Text style={[styles.credRoleText, isSelected && styles.credRoleTextSelected]}>
                      {r.label}
                    </Text>
                    <Text style={styles.credEmoji}>{r.icon}</Text>
                  </View>
                  <Text style={styles.credDesc}>{r.desc}</Text>
                  <Text style={styles.credPhone}>+91 {r.phone}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Mobile Number</Text>
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

          {/* OTP Input (Shown when sent or prefilled) */}
          {otpSent && (
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Enter 6-digit OTP Code</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
              />
              <Text style={styles.otpHint}>Code valid for 5 minutes. (Demo dev code: 123456)</Text>
            </View>
          )}

          {/* Vibrant Orange Action Button matching POC */}
          {!otpSent ? (
            <TouchableOpacity
              style={styles.orangeBtn}
              disabled={loading}
              onPress={handleSendOtp}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.orangeBtnText}>Send OTP Verification Code →</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={styles.orangeBtn}
                disabled={loading}
                onPress={handleVerify}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.orangeBtnText}>Enter demo →</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendBtn} onPress={handleSendOtp}>
                <Text style={styles.resendBtnText}>Resend OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* POC Demo Notice Banner */}
          <View style={styles.demoNotice}>
            <Text style={styles.demoNoticeText}>
              Illustrative demonstration only. No real orders, payments, identity documents or customer data are used.
            </Text>
          </View>

          {/* Google Identity Phone Auth Option */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR SIGN IN WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            disabled={loading}
            onPress={handleGooglePhoneDemo}
            activeOpacity={0.8}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleBtnText}>Verify Phone with Google Identity</Text>
          </TouchableOpacity>
        </View>

        {/* Back Link */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back to Marketplace Persona Switcher</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topline: {
    height: 4,
    flexDirection: 'row',
    width: '100%',
  },
  toplineCyan: {
    flex: 55,
    backgroundColor: '#02a7ef',
  },
  toplineOrange: {
    flex: 45,
    backgroundColor: '#ff9418',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 32,
    backgroundColor: '#f5f8fc',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  logo: {
    width: 220,
    height: 60,
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce6ef',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#073f7c',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  eyebrow: {
    fontSize: 10,
    color: '#078ee8',
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#142b46',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#6f7f91',
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 16,
  },
  gridHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6f7f91',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  credGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  credBtn: {
    width: '48.5%',
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dce6ef',
    borderRadius: 10,
    padding: 10,
  },
  credBtnSelected: {
    backgroundColor: '#eef5fc',
    borderColor: '#073f7c',
    borderWidth: 1.5,
  },
  credBtnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  credRoleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#073f7c',
  },
  credRoleTextSelected: {
    color: '#073f7c',
  },
  credEmoji: {
    fontSize: 15,
  },
  credDesc: {
    fontSize: 10,
    color: '#6f7f91',
    marginTop: 2,
  },
  credPhone: {
    fontSize: 10,
    fontWeight: '600',
    color: '#142b46',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#142b46',
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  prefixBox: {
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#dce6ef',
    borderRadius: 9,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#142b46',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#fafcff',
    borderWidth: 1,
    borderColor: '#dce6ef',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '600',
    color: '#142b46',
  },
  otpInput: {
    backgroundColor: '#fafcff',
    borderWidth: 1,
    borderColor: '#dce6ef',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#073f7c',
  },
  otpHint: {
    fontSize: 11,
    color: '#6f7f91',
    marginTop: 4,
    textAlign: 'center',
  },
  orangeBtn: {
    backgroundColor: '#ff8a16',
    paddingVertical: 13,
    borderRadius: 9,
    alignItems: 'center',
    marginTop: 6,
  },
  orangeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  resendBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#073f7c',
  },
  demoNotice: {
    backgroundColor: '#fff7e9',
    borderColor: '#ffe0a6',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
  },
  demoNoticeText: {
    fontSize: 10,
    color: '#885100',
    lineHeight: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dce6ef',
  },
  dividerText: {
    fontSize: 10,
    color: '#6f7f91',
    paddingHorizontal: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#dce6ef',
    gap: 8,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142b46',
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backBtnText: {
    fontSize: 12,
    color: '#6f7f91',
    fontWeight: '600',
  },
});
