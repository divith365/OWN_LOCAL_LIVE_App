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
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRole } from '@ownlocal/types';
import { useAuth } from '../src/context/AuthContext';
import { apiClient } from '../src/api';

const STORE_CATEGORIES = [
  'Food & Dining',
  'Kirana & Daily Needs',
  'Fresh Fruits & Veggies',
  'Ilkal Sarees & Handloom',
  'Pharmacy & Healthcare',
];

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithOtp, loginWithGooglePhone } = useAuth();

  const [phone, setPhone] = useState('9876543210');
  const [role, setRole] = useState<UserRole>('customer');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('123456');
  const [loading, setLoading] = useState(false);

  // Merchant Self-Registration Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('Food & Dining');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopRadiusKm, setShopRadiusKm] = useState(6);
  const [shopCoords, setShopCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectingShopGps, setDetectingShopGps] = useState(false);
  const [registeringShop, setRegisteringShop] = useState(false);

  const handleDetectShopLocation = async () => {
    setDetectingShopGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Using central Ilkal coordinates.');
        setShopCoords({ lat: 15.9587, lng: 76.1264 });
        setShopAddress('Main Bazaar Road, Near Old Bus Stand, Ilkal - 587125');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setShopCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [rev] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (rev) {
        const parts = [rev.name, rev.street, rev.subregion || rev.city || 'Ilkal', rev.postalCode || '587125'].filter(Boolean);
        setShopAddress(parts.join(', '));
      } else {
        setShopAddress('Main Road, Ilkal - 587125');
      }
    } catch {
      setShopCoords({ lat: 15.9587, lng: 76.1264 });
      setShopAddress('Main Road, Near Old Bus Stand, Ilkal - 587125');
    } finally {
      setDetectingShopGps(false);
    }
  };

  const handleRegisterStore = async () => {
    if (!shopName.trim()) {
      Alert.alert('Required', 'Please enter shop/business name.');
      return;
    }
    if (!shopPhone.trim() || shopPhone.trim().length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!shopAddress.trim()) {
      Alert.alert('Required', 'Please enter shop address or auto-detect with GPS.');
      return;
    }
    const coords = shopCoords || { lat: 15.9587, lng: 76.1264 };
    setRegisteringShop(true);
    try {
      const res = await apiClient.createMerchant({
        business_name: shopName.trim(),
        category: shopCategory,
        phone: shopPhone.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        address: shopAddress.trim(),
        town: 'Ilkal',
        service_radius_km: shopRadiusKm,
        status: 'approved',
      });
      if (res.success) {
        Alert.alert('Store Registered! 🎉', `Welcome ${shopName}! Your store is now active in Ilkal.`);
        setShowRegisterModal(false);
        // Auto login as merchant
        await loginWithOtp(shopPhone.trim(), '123456', 'merchant');
        router.replace('/(merchant)');
      } else {
        Alert.alert('Registration Error', res.error?.message || 'Could not register store.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Could not connect to server.');
    } finally {
      setRegisteringShop(false);
    }
  };

  // Rider Self-Registration Modal state
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderVehicleType, setRiderVehicleType] = useState<'bike' | 'scooter' | 'cycle' | 'auto'>('bike');
  const [riderVehicleNumber, setRiderVehicleNumber] = useState('');
  const [riderPreferredRadiusKm, setRiderPreferredRadiusKm] = useState(3.0);
  const [registeringRider, setRegisteringRider] = useState(false);

  const handleRegisterRider = async () => {
    if (!riderName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    if (!riderPhone.trim() || riderPhone.trim().length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!riderVehicleNumber.trim()) {
      Alert.alert('Required', 'Please enter your vehicle registration number (e.g. KA-29-EE-1234).');
      return;
    }

    setRegisteringRider(true);
    try {
      const res = await apiClient.registerRider({
        name: riderName.trim(),
        phone: riderPhone.trim(),
        vehicle_type: riderVehicleType,
        vehicle_number: riderVehicleNumber.trim().toUpperCase(),
        preferred_radius_km: riderPreferredRadiusKm,
      });

      if (res.success) {
        Alert.alert(
          'Rider Registered! 🎉',
          `Welcome to the fleet, ${riderName}! You are active for deliveries with preferred pickup radius of ${riderPreferredRadiusKm} km.`
        );
        setShowRiderModal(false);
        setRiderName('');
        setRiderPhone('');
        setRiderVehicleNumber('');
        // Auto login as rider
        await loginWithOtp(riderPhone.trim(), '123456', 'rider');
        router.replace('/(rider)');
      } else {
        Alert.alert('Registration Error', res.error?.message || 'Could not register as rider.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Could not connect to server.');
    } finally {
      setRegisteringRider(false);
    }
  };

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

          {/* Merchant Self-Registration Banner */}
          <View style={styles.registerStoreBox}>
            <Text style={styles.registerStoreIcon}>🏪</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.registerStoreTitle}>Own a local shop in Ilkal?</Text>
              <Text style={styles.registerStoreSub}>Register your store and start selling online in minutes.</Text>
            </View>
            <TouchableOpacity
              style={styles.registerStoreBtn}
              onPress={() => {
                setShowRegisterModal(true);
                if (!shopCoords) handleDetectShopLocation();
              }}
            >
              <Text style={styles.registerStoreBtnText}>Register Store</Text>
            </TouchableOpacity>
          </View>

          {/* Rider Self-Registration Banner */}
          <View style={[styles.registerStoreBox, { borderColor: '#bfdbfe', backgroundColor: '#f0f9ff', marginTop: 10 }]}>
            <Text style={styles.registerStoreIcon}>🛵</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.registerStoreTitle, { color: '#0369a1' }]}>Want to deliver & earn in Ilkal?</Text>
              <Text style={[styles.registerStoreSub, { color: '#0c4a6e' }]}>Join the delivery fleet & earn ₹35 per completed trip.</Text>
            </View>
            <TouchableOpacity
              style={[styles.registerStoreBtn, { backgroundColor: '#0284c7' }]}
              onPress={() => setShowRiderModal(true)}
            >
              <Text style={styles.registerStoreBtnText}>Join Fleet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal: Register Store with GPS Auto-Pick */}
        <Modal
          visible={showRegisterModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRegisterModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.addModalCard}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitle}>Register Store in Ilkal</Text>
                  <Text style={styles.modalSub}>Start selling to local customers</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowRegisterModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                {/* Business Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Store / Shop Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Mahant Sweets & Bakery"
                    placeholderTextColor="#94a3b8"
                    value={shopName}
                    onChangeText={setShopName}
                  />
                </View>

                {/* Category */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Store Category *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {STORE_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, shopCategory === cat && styles.categoryChipActive]}
                        onPress={() => setShopCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, shopCategory === cat && styles.categoryChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Phone */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Owner Mobile Number (10 digits) *</Text>
                  <View style={styles.phoneInputRow}>
                    <Text style={styles.phonePrefix}>+91</Text>
                    <TextInput
                      style={styles.phoneInputBox}
                      placeholder="9876543210"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={shopPhone}
                      onChangeText={setShopPhone}
                    />
                  </View>
                </View>

                {/* GPS Auto-Pick Section */}
                <View style={styles.formGroup}>
                  <View style={styles.gpsHeaderRow}>
                    <Text style={styles.formLabel}>Store GPS Location *</Text>
                    <TouchableOpacity
                      style={styles.detectGpsBtn}
                      disabled={detectingShopGps}
                      onPress={handleDetectShopLocation}
                    >
                      {detectingShopGps ? (
                        <ActivityIndicator size="small" color="#0369a1" />
                      ) : (
                        <Text style={styles.detectGpsText}>📍 Auto-Pick GPS</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {shopCoords ? (
                    <View style={styles.gpsCoordinatesBadge}>
                      <Text style={styles.gpsCoordinatesText}>
                        ✓ GPS Lat: {shopCoords.lat.toFixed(5)}, Lng: {shopCoords.lng.toFixed(5)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.gpsHelpText}>Tap Auto-Pick to detect coordinates via phone GPS</Text>
                  )}
                </View>

                {/* Address */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Shop Street Address / Landmark *</Text>
                  <TextInput
                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                    placeholder="Auto-filled via GPS or enter street address"
                    placeholderTextColor="#94a3b8"
                    multiline={true}
                    value={shopAddress}
                    onChangeText={setShopAddress}
                  />
                </View>

                {/* Delivery Radius */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Delivery Radius: {shopRadiusKm} km</Text>
                  <View style={styles.radiusRow}>
                    {[3, 5, 8, 10].map((km) => (
                      <TouchableOpacity
                        key={km}
                        style={[styles.radiusBtn, shopRadiusKm === km && styles.radiusBtnActive]}
                        onPress={() => setShopRadiusKm(km)}
                      >
                        <Text style={[styles.radiusBtnText, shopRadiusKm === km && styles.radiusBtnTextActive]}>
                          {km} km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Modal Actions */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRegisterModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  disabled={registeringShop}
                  onPress={handleRegisterStore}
                >
                  {registeringShop ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Register & Open Store 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Register as Rider */}
        <Modal
          visible={showRiderModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowRiderModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.addModalCard}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalTitle}>Join as Delivery Rider</Text>
                  <Text style={styles.modalSub}>Deliver in Ilkal & earn per order</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowRiderModal(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                {/* Rider Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Ramesh Pujar"
                    placeholderTextColor="#94a3b8"
                    value={riderName}
                    onChangeText={setRiderName}
                  />
                </View>

                {/* Mobile Number */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Mobile Number (10 digits) *</Text>
                  <View style={styles.phoneInputRow}>
                    <Text style={styles.phonePrefix}>+91</Text>
                    <TextInput
                      style={styles.phoneInputBox}
                      placeholder="9876543210"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={riderPhone}
                      onChangeText={setRiderPhone}
                    />
                  </View>
                </View>

                {/* Vehicle Type */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Vehicle Type *</Text>
                  <View style={styles.radiusRow}>
                    {(['bike', 'scooter', 'cycle', 'auto'] as const).map((vt) => (
                      <TouchableOpacity
                        key={vt}
                        style={[styles.radiusBtn, riderVehicleType === vt && styles.radiusBtnActive]}
                        onPress={() => setRiderVehicleType(vt)}
                      >
                        <Text style={[styles.radiusBtnText, riderVehicleType === vt && styles.radiusBtnTextActive]}>
                          {vt === 'bike' ? '🏍️ Bike' : vt === 'scooter' ? '🛵 Scooter' : vt === 'cycle' ? '🚲 Cycle' : '🛺 Auto'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Vehicle Registration Number */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Vehicle Registration Number *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. KA-29-EE-5432"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={riderVehicleNumber}
                    onChangeText={setRiderVehicleNumber}
                  />
                </View>

                {/* Preferred Operating Radius */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Preferred Pickup Radius: {riderPreferredRadiusKm} km</Text>
                  <Text style={styles.gpsHelpText}>Stores matched within this radius from your GPS location</Text>
                  <View style={styles.radiusRow}>
                    {[2, 3, 5, 8, 10].map((km) => (
                      <TouchableOpacity
                        key={km}
                        style={[styles.radiusBtn, riderPreferredRadiusKm === km && styles.radiusBtnActive]}
                        onPress={() => setRiderPreferredRadiusKm(km)}
                      >
                        <Text style={[styles.radiusBtnText, riderPreferredRadiusKm === km && styles.radiusBtnTextActive]}>
                          {km} km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Modal Actions */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRiderModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#0284c7' }]}
                  disabled={registeringRider}
                  onPress={handleRegisterRider}
                >
                  {registeringRider ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Join Delivery Fleet 🛵</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  registerStoreBox: {
    marginTop: 18,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  registerStoreIcon: {
    fontSize: 26,
  },
  registerStoreTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
  },
  registerStoreSub: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 2,
    lineHeight: 15,
  },
  registerStoreBtn: {
    backgroundColor: '#ff8a16',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  registerStoreBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 30, 56, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  addModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    color: '#0f172a',
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  categoryChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#0369a1',
    fontWeight: '800',
  },
  phonePrefix: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  phoneInputBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detectGpsBtn: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detectGpsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  gpsCoordinatesBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  gpsCoordinatesText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  gpsHelpText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  radiusBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radiusBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  radiusBtnText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  radiusBtnTextActive: {
    color: '#b45309',
    fontWeight: '800',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#ff8a16',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
