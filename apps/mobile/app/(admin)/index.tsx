import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import * as Location from 'expo-location';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api';
import { MerchantProfile, RiderProfile, OrderStatus } from '@ownlocal/types';
import { BrandHeader } from '../../src/components/BrandHeader';

const STORE_CATEGORIES = [
  'Food & Dining',
  'Kirana & Daily Needs',
  'Fresh Fruits & Veggies',
  'Ilkal Sarees & Handloom',
  'Pharmacy & Healthcare',
];

export default function AdminDashboardScreen() {
  const [metrics, setMetrics] = useState<any>({
    total_orders: 0,
    total_gmv: 0,
    merchants_count: 0,
    riders_count: 0,
    platform_revenue: 0,
    town: 'Ilkal',
  });
  const [merchants, setMerchants] = useState<MerchantProfile[]>([]);
  const [riders, setRiders] = useState<RiderProfile[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'METRICS' | 'MERCHANTS' | 'RIDERS' | 'ORDERS'>('METRICS');
  const [platformRadius, setPlatformRadius] = useState<number>(3.0);
  const [savingPlatformRadius, setSavingPlatformRadius] = useState<boolean>(false);

  // Add Merchant Modal state with GPS Auto-Pick
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newCategory, setNewCategory] = useState('Food & Dining');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRadiusKm, setNewRadiusKm] = useState(6);
  const [newCoords, setNewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [savingMerchant, setSavingMerchant] = useState(false);

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Using central Ilkal coordinates.');
        setNewCoords({ lat: 15.9587, lng: 76.1264 });
        setNewAddress('Main Bazaar Road, Near Old Bus Stand, Ilkal - 587125');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNewCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [rev] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (rev) {
        const parts = [rev.name, rev.street, rev.subregion || rev.city || 'Ilkal', rev.postalCode || '587125'].filter(Boolean);
        setNewAddress(parts.join(', '));
      } else {
        setNewAddress('Main Road, Ilkal - 587125');
      }
    } catch {
      setNewCoords({ lat: 15.9587, lng: 76.1264 });
      setNewAddress('Main Road, Near Old Bus Stand, Ilkal - 587125');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleSaveMerchant = async () => {
    if (!newBusinessName.trim()) {
      Alert.alert('Required', 'Please enter shop/business name.');
      return;
    }
    if (!newPhone.trim() || newPhone.trim().length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!newAddress.trim()) {
      Alert.alert('Required', 'Please enter shop address or auto-detect with GPS.');
      return;
    }
    const coords = newCoords || { lat: 15.9587, lng: 76.1264 };
    setSavingMerchant(true);
    try {
      const res = await apiClient.createMerchant({
        business_name: newBusinessName.trim(),
        category: newCategory,
        phone: newPhone.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        address: newAddress.trim(),
        town: 'Ilkal',
        service_radius_km: newRadiusKm,
        status: 'approved',
      });
      if (res.success) {
        Alert.alert('Store Onboarded! 🎉', 'Store is now live in marketplace!');
        setShowAddModal(false);
        setNewBusinessName('');
        setNewPhone('');
        setNewAddress('');
        setNewCoords(null);
        fetchAdminData(true);
      } else {
        Alert.alert('Error', res.error?.message || 'Could not onboard store.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Could not connect to server.');
    } finally {
      setSavingMerchant(false);
    }
  };

  // Add Rider Modal state
  const [showAddRiderModal, setShowAddRiderModal] = useState(false);
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');
  const [newRiderVehicleType, setNewRiderVehicleType] = useState<'bike' | 'scooter' | 'cycle' | 'auto'>('bike');
  const [newRiderVehicleNumber, setNewRiderVehicleNumber] = useState('');
  const [newRiderRadiusKm, setNewRiderRadiusKm] = useState(3.0);
  const [savingRider, setSavingRider] = useState(false);

  const handleSaveRider = async () => {
    if (!newRiderName.trim()) {
      Alert.alert('Required', 'Please enter rider full name.');
      return;
    }
    if (!newRiderPhone.trim() || newRiderPhone.trim().length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!newRiderVehicleNumber.trim()) {
      Alert.alert('Required', 'Please enter vehicle registration number.');
      return;
    }

    setSavingRider(true);
    try {
      const res = await apiClient.registerRider({
        name: newRiderName.trim(),
        phone: newRiderPhone.trim(),
        vehicle_type: newRiderVehicleType,
        vehicle_number: newRiderVehicleNumber.trim().toUpperCase(),
        preferred_radius_km: newRiderRadiusKm,
      });

      if (res.success) {
        Alert.alert('Rider Onboarded! 🎉', `${newRiderName} is now registered in the fleet.`);
        setShowAddRiderModal(false);
        setNewRiderName('');
        setNewRiderPhone('');
        setNewRiderVehicleNumber('');
        fetchAdminData(true);
      } else {
        Alert.alert('Error', res.error?.message || 'Could not onboard rider.');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Could not connect to server.');
    } finally {
      setSavingRider(false);
    }
  };

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAdminData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [mRes, merchRes, riderRes, orderRes, settingsRes] = await Promise.all([
        apiClient.getAdminMetrics(),
        apiClient.getAdminMerchants(),
        apiClient.getAdminRiders(),
        apiClient.getAdminOrders(),
        apiClient.getPlatformSettings(),
      ]);

      if (mRes.success && mRes.data) setMetrics(mRes.data);
      if (merchRes.success && merchRes.data) setMerchants(merchRes.data);
      if (riderRes.success && riderRes.data) setRiders(riderRes.data);
      if (orderRes.success && orderRes.data) setOrders(orderRes.data);
      if (settingsRes.success && settingsRes.data?.platform_rider_matching_radius_km) {
        setPlatformRadius(settingsRes.data.platform_rider_matching_radius_km);
      }
    } catch (e) {
      console.error('Failed to fetch admin data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSavePlatformRadius = async (newRadius: number) => {
    setPlatformRadius(newRadius);
    setSavingPlatformRadius(true);
    try {
      const res = await apiClient.updatePlatformSettings({ platform_rider_matching_radius_km: newRadius });
      if (res.success) {
        Alert.alert(
          'Platform Settings Updated! 🛡️',
          `Town rider matching radius set to ${newRadius} km.\nEligible riders within this distance from merchant pickup will receive job offers.`
        );
      } else {
        Alert.alert('Error', res.error?.message || 'Could not save platform settings');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Network error');
    } finally {
      setSavingPlatformRadius(false);
    }
  };

  useEffect(() => {
    fetchAdminData(false);

    // Auto-poll every 6 seconds for town control tower
    pollTimerRef.current = setInterval(() => {
      fetchAdminData(false);
    }, 6000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchAdminData]);

  const handleUpdateMerchantStatus = async (merchantId: string, newStatus: string) => {
    setActionLoadingId(merchantId);
    try {
      const res = await apiClient.updateAdminMerchantStatus(merchantId, newStatus);
      if (res.success) {
        Alert.alert('Status Updated', `Merchant status set to ${newStatus}`);
        fetchAdminData(false);
      } else {
        Alert.alert('Error', res.error?.message || 'Could not update merchant status');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Update failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateRiderStatus = async (riderId: string, newStatus: string) => {
    setActionLoadingId(riderId);
    try {
      const res = await apiClient.updateAdminRiderStatus(riderId, newStatus);
      if (res.success) {
        Alert.alert('Status Updated', `Rider status set to ${newStatus}`);
        fetchAdminData(false);
      } else {
        Alert.alert('Error', res.error?.message || 'Could not update rider status');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Update failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteMerchant = (merchantId: string, name: string) => {
    Alert.alert(
      'Delete Store',
      `Are you sure you want to permanently delete "${name}"? Its catalog products will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Store',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(merchantId);
            try {
              const res = await apiClient.deleteAdminMerchant(merchantId);
              if (res.success) {
                Alert.alert('Store Deleted', `"${name}" removed from town.`);
                fetchAdminData(false);
              } else {
                Alert.alert('Error', res.error?.message || 'Could not delete merchant');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Delete failed');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteRider = (riderId: string, name: string) => {
    Alert.alert(
      'Remove Rider',
      `Are you sure you want to remove rider "${name}" from the fleet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Rider',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(riderId);
            try {
              const res = await apiClient.deleteAdminRider(riderId);
              if (res.success) {
                Alert.alert('Rider Removed', `"${name}" removed from fleet.`);
                fetchAdminData(false);
              } else {
                Alert.alert('Error', res.error?.message || 'Could not remove rider');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Remove failed');
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to Platform Control Tower...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
      <BrandHeader currentRole="admin" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAdminData(true)} />}
      >
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <Text style={styles.title}>Town Operations Control Tower</Text>
        <Text style={styles.subtitle}>Super Admin Live Governance & Platform Control</Text>
      </View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>₹{metrics.total_gmv}</Text>
          <Text style={styles.kpiLabel}>Town GMV</Text>
          <Text style={styles.kpiChange}>Gross Volume</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{metrics.total_orders}</Text>
          <Text style={styles.kpiLabel}>Total Orders</Text>
          <Text style={styles.kpiChange}>Real-time Sync</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>₹{metrics.platform_revenue}</Text>
          <Text style={styles.kpiLabel}>Net Platform Take</Text>
          <Text style={styles.kpiChange}>Convenience Fees</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiVal}>{metrics.merchants_count}</Text>
          <Text style={styles.kpiLabel}>Approved Stores</Text>
          <Text style={styles.kpiChange}>Active Merchant Base</Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'METRICS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('METRICS')}
        >
          <Text style={[styles.tabText, activeTab === 'METRICS' && styles.tabTextActive]}>
            📊 Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'MERCHANTS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('MERCHANTS')}
        >
          <Text style={[styles.tabText, activeTab === 'MERCHANTS' && styles.tabTextActive]}>
            🏬 Stores ({merchants.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'RIDERS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('RIDERS')}
        >
          <Text style={[styles.tabText, activeTab === 'RIDERS' && styles.tabTextActive]}>
            🛵 Riders ({riders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ORDERS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ORDERS')}
        >
          <Text style={[styles.tabText, activeTab === 'ORDERS' && styles.tabTextActive]}>
            📦 Audit ({orders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab: Overview & Operational Health */}
      {activeTab === 'METRICS' && (
        <View style={styles.sectionCol}>
          <View style={styles.auditCard}>
            <Text style={styles.auditTitle}>🟢 Platform Network Health</Text>
            <Text style={styles.auditText}>• Gateway Status: Active & Operational</Text>
            <Text style={styles.auditText}>• Verified Merchant Base: {merchants.length} Approved Stores</Text>
            <Text style={styles.auditText}>• Registered Fleet: {riders.length} Delivery Partners</Text>
            <Text style={styles.auditText}>• Security & Integrity: 4-Digit Delivery OTP Handshake Active</Text>
          </View>
        </View>
      )}

      {/* Tab: Merchant Approvals & Management */}
      {activeTab === 'MERCHANTS' && (
        <View style={styles.sectionCol}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeading}>Merchant Directory</Text>
              <Text style={styles.sectionSub}>Active town shops and compliance</Text>
            </View>
            <TouchableOpacity
              style={styles.addMerchantBtn}
              onPress={() => {
                setShowAddModal(true);
                if (!newCoords) handleDetectLocation();
              }}
            >
              <Text style={styles.addMerchantBtnText}>➕ Add Store</Text>
            </TouchableOpacity>
          </View>

          {merchants.map((m) => {
            const isApproved = m.status === 'approved';
            const isUpdating = actionLoadingId === m.id;

            return (
              <View key={m.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{m.business_name}</Text>
                    <Text style={styles.itemCategory}>{m.category} • ★ {m.rating || '4.8'}</Text>
                    <Text style={styles.itemAddress}>📍 {m.address}</Text>
                    <Text style={styles.itemMeta}>📞 {m.phone || 'N/A'}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: isApproved ? Colors.successLight : Colors.warningLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: isApproved ? Colors.success : Colors.warning },
                      ]}
                    >
                      {m.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemActionsRow}>
                  {isApproved ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.suspendBtn]}
                      disabled={isUpdating}
                      onPress={() => handleUpdateMerchantStatus(m.id, 'suspended')}
                    >
                      <Text style={styles.suspendBtnText}>Suspend Store</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      disabled={isUpdating}
                      onPress={() => handleUpdateMerchantStatus(m.id, 'approved')}
                    >
                      <Text style={styles.approveBtnText}>Approve Store</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    disabled={isUpdating}
                    onPress={() => handleDeleteMerchant(m.id, m.business_name)}
                  >
                    <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Modal: Add New Merchant with GPS Auto-Pick */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.addModalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Onboard New Store</Text>
                <Text style={styles.modalSub}>Town Merchant Directory</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* Business Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Shop / Business Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Shri Raghavendra Sweets"
                  placeholderTextColor={Colors.slate400}
                  value={newBusinessName}
                  onChangeText={setNewBusinessName}
                />
              </View>

              {/* Category */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Store Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {STORE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text style={[styles.categoryChipText, newCategory === cat && styles.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Store Mobile Number (10 digits) *</Text>
                <View style={styles.phoneInputRow}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <TextInput
                    style={styles.phoneInputBox}
                    placeholder="9876543210"
                    placeholderTextColor={Colors.slate400}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={newPhone}
                    onChangeText={setNewPhone}
                  />
                </View>
              </View>

              {/* GPS Auto-Pick Section */}
              <View style={styles.formGroup}>
                <View style={styles.gpsHeaderRow}>
                  <Text style={styles.formLabel}>Shop GPS Location *</Text>
                  <TouchableOpacity
                    style={styles.detectGpsBtn}
                    disabled={detectingLocation}
                    onPress={handleDetectLocation}
                  >
                    {detectingLocation ? (
                      <ActivityIndicator size="small" color="#0369a1" />
                    ) : (
                      <Text style={styles.detectGpsText}>📍 Auto-Pick GPS</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {newCoords ? (
                  <View style={styles.gpsCoordinatesBadge}>
                    <Text style={styles.gpsCoordinatesText}>
                      ✓ GPS Lat: {newCoords.lat.toFixed(5)}, Lng: {newCoords.lng.toFixed(5)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.gpsHelpText}>Tap Auto-Pick to detect coordinates via phone GPS</Text>
                )}
              </View>

              {/* Address */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Street Address / Landmark *</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Auto-filled via GPS or enter street address"
                  placeholderTextColor={Colors.slate400}
                  multiline={true}
                  value={newAddress}
                  onChangeText={setNewAddress}
                />
              </View>

              {/* Delivery Radius */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Service Radius: {newRadiusKm} km</Text>
                <View style={styles.radiusRow}>
                  {[3, 5, 8, 10].map((km) => (
                    <TouchableOpacity
                      key={km}
                      style={[styles.radiusBtn, newRadiusKm === km && styles.radiusBtnActive]}
                      onPress={() => setNewRadiusKm(km)}
                    >
                      <Text style={[styles.radiusBtnText, newRadiusKm === km && styles.radiusBtnTextActive]}>
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
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                disabled={savingMerchant}
                onPress={handleSaveMerchant}
              >
                {savingMerchant ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Onboard & Go Live 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Add / Onboard New Rider by Admin */}
      <Modal
        visible={showAddRiderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddRiderModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.addModalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Onboard Delivery Rider</Text>
                <Text style={styles.modalSub}>Add rider to town delivery fleet</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAddRiderModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {/* Rider Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Rider Full Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Basavaraj Kulkarni"
                  placeholderTextColor={Colors.slate400}
                  value={newRiderName}
                  onChangeText={setNewRiderName}
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
                    placeholderTextColor={Colors.slate400}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={newRiderPhone}
                    onChangeText={setNewRiderPhone}
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
                      style={[styles.radiusBtn, newRiderVehicleType === vt && styles.radiusBtnActive]}
                      onPress={() => setNewRiderVehicleType(vt)}
                    >
                      <Text style={[styles.radiusBtnText, newRiderVehicleType === vt && styles.radiusBtnTextActive]}>
                        {vt === 'bike' ? '🏍️ Bike' : vt === 'scooter' ? '🛵 Scooter' : vt === 'cycle' ? '🚲 Cycle' : '🛺 Auto'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Vehicle Number */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Vehicle Registration Number *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. KA-29-EE-7890"
                  placeholderTextColor={Colors.slate400}
                  autoCapitalize="characters"
                  value={newRiderVehicleNumber}
                  onChangeText={setNewRiderVehicleNumber}
                />
              </View>

              {/* Preferred Radius */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Preferred Pickup Radius: {newRiderRadiusKm} km</Text>
                <View style={styles.radiusRow}>
                  {[2, 3, 5, 8, 10].map((km) => (
                    <TouchableOpacity
                      key={km}
                      style={[styles.radiusBtn, newRiderRadiusKm === km && styles.radiusBtnActive]}
                      onPress={() => setNewRiderRadiusKm(km)}
                    >
                      <Text style={[styles.radiusBtnText, newRiderRadiusKm === km && styles.radiusBtnTextActive]}>
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
                onPress={() => setShowAddRiderModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#0284c7' }]}
                disabled={savingRider}
                onPress={handleSaveRider}
              >
                {savingRider ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Add Rider to Fleet 🛵</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tab: Riders Directory & Duty Status */}
      {activeTab === 'RIDERS' && (
        <View style={styles.sectionCol}>
          {/* Global Dispatch Radius Configurator */}
          <View style={styles.dispatchSettingsCard}>
            <View style={styles.dispatchHeaderRow}>
              <Text style={styles.dispatchTitle}>🛡️ Platform Rider Matching Radius</Text>
              <View style={styles.dispatchRadiusBadge}>
                <Text style={styles.dispatchRadiusBadgeText}>{platformRadius} km Default</Text>
              </View>
            </View>
            <Text style={styles.dispatchSub}>
              Maximum pickup distance from merchant shop to rider current GPS location. When a store confirms an order, riders within this radius receive job offers.
            </Text>

            <View style={styles.radiusSelectorRow}>
              {[2, 3, 4, 5, 8, 10].map((km) => (
                <TouchableOpacity
                  key={km}
                  style={[styles.radiusChip, platformRadius === km && styles.radiusChipActive]}
                  disabled={savingPlatformRadius}
                  onPress={() => handleSavePlatformRadius(km)}
                >
                  <Text style={[styles.radiusChipText, platformRadius === km && styles.radiusChipTextActive]}>
                    {km} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Rider Fleet Directory ({riders.length})</Text>
            <TouchableOpacity
              style={[styles.addMerchantBtn, { backgroundColor: '#0284c7' }]}
              onPress={() => setShowAddRiderModal(true)}
            >
              <Text style={styles.addMerchantBtnText}>+ Onboard Rider</Text>
            </TouchableOpacity>
          </View>

          {riders.map((r) => {
            const isApproved = r.status === 'approved';
            const isDuty = Boolean(r.online_status);
            const isUpdating = actionLoadingId === r.id;

            return (
              <View key={r.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{r.name}</Text>
                    <Text style={styles.itemCategory}>
                      🛵 {r.vehicle_number} • {r.vehicle_type?.toUpperCase()}
                    </Text>
                    <Text style={styles.itemMeta}>📞 {r.phone}</Text>
                    <Text style={styles.riderRadiusMeta}>
                      🎯 Operating Radius: {r.preferred_radius_km ? `${r.preferred_radius_km} km (Rider Choice)` : `Default (${platformRadius} km)`}
                    </Text>
                    <Text style={styles.riderGpsMeta}>
                      📍 Last GPS: {r.current_latitude && r.current_longitude ? `${r.current_latitude.toFixed(4)}° N, ${r.current_longitude.toFixed(4)}° E` : 'Pending GPS report'}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: isApproved ? Colors.successLight : Colors.warningLight },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: isApproved ? Colors.success : Colors.warning },
                        ]}
                      >
                        {r.status?.toUpperCase()}
                      </Text>
                    </View>

                    <Text style={[styles.dutyTag, { color: isDuty ? Colors.success : Colors.slate500 }]}>
                      {isDuty ? '🟢 ON DUTY' : '⚪ OFF DUTY'}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemActionsRow}>
                  {isApproved ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.suspendBtn]}
                      disabled={isUpdating}
                      onPress={() => handleUpdateRiderStatus(r.id, 'suspended')}
                    >
                      <Text style={styles.suspendBtnText}>Suspend Rider</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      disabled={isUpdating}
                      onPress={() => handleUpdateRiderStatus(r.id, 'approved')}
                    >
                      <Text style={styles.approveBtnText}>Approve Rider</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    disabled={isUpdating}
                    onPress={() => handleDeleteRider(r.id, r.name)}
                  >
                    <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tab: Orders Audit Stream */}
      {activeTab === 'ORDERS' && (
        <View style={styles.sectionCol}>
          <Text style={styles.sectionHeading}>Live Town Orders Stream</Text>

          {orders.map((o) => {
            const statusConfig = getOrderStatusConfig(o.status as OrderStatus);

            return (
              <View key={o.id} style={styles.orderAuditCard}>
                <View style={styles.orderAuditTop}>
                  <View>
                    <Text style={styles.orderNumber}>{o.order_number}</Text>
                    <Text style={styles.merchantAuditName}>{o.merchant_name || 'Store'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.auditDivider} />

                <View style={styles.auditMetaRow}>
                  <Text style={styles.auditMetaText}>📅 {o.created_at}</Text>
                  <Text style={styles.auditTotal}>₹{o.grand_total}</Text>
                </View>

                <Text style={styles.auditAddress}>📍 Drop: {o.delivery_address}</Text>

                {o.rider_name && (
                  <Text style={styles.auditRider}>🛵 Rider: {o.rider_name}</Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 12,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 80,
    gap: Spacing.md,
  },
  headerCard: {
    backgroundColor: Colors.slate900,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  townTag: {
    ...Typography.captionBold,
    color: Colors.secondaryLight,
    letterSpacing: 1,
  },
  title: {
    ...Typography.title2,
    color: Colors.white,
    marginTop: 4,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.slate400,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiVal: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  kpiLabel: {
    ...Typography.captionBold,
    color: Colors.slate700,
    marginTop: 2,
  },
  kpiChange: {
    fontSize: 10,
    color: Colors.primaryDark,
    marginTop: 4,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: Colors.slate900,
  },
  tabText: {
    ...Typography.caption,
    color: Colors.slate600,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  sectionCol: {
    gap: Spacing.md,
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  sectionSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  auditCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  auditTitle: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    marginBottom: Spacing.sm,
  },
  auditText: {
    ...Typography.subhead,
    color: Colors.slate700,
    lineHeight: 22,
  },
  governanceCard: {
    backgroundColor: Colors.primaryTint,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  govTitle: {
    ...Typography.bodyBold,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  govText: {
    ...Typography.caption,
    color: Colors.slate700,
    lineHeight: 18,
  },
  itemCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  itemCategory: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  itemAddress: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  itemMeta: {
    ...Typography.caption,
    color: Colors.slate600,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dutyTag: {
    fontSize: 10,
    fontWeight: '700',
  },
  itemActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
  },
  approveBtn: {
    backgroundColor: Colors.success,
  },
  approveBtnText: {
    ...Typography.captionBold,
    color: Colors.white,
  },
  suspendBtn: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  suspendBtnText: {
    ...Typography.captionBold,
    color: Colors.warning,
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  deleteBtnText: {
    ...Typography.captionBold,
    color: '#b91c1c',
  },
  orderAuditCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderAuditTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  merchantAuditName: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  auditDivider: {
    height: 1,
    backgroundColor: Colors.slate100,
    marginVertical: Spacing.sm,
  },
  auditMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditMetaText: {
    ...Typography.caption,
    color: Colors.slate600,
  },
  auditTotal: {
    ...Typography.bodyBold,
    color: Colors.primaryDark,
  },
  auditAddress: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  auditRider: {
    ...Typography.captionBold,
    color: Colors.slate700,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addMerchantBtn: {
    backgroundColor: '#ff8a16',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addMerchantBtnText: {
    ...Typography.captionBold,
    color: Colors.white,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 30, 56, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  addModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.slate900,
    fontWeight: '800',
  },
  modalSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: Colors.slate600,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formLabel: {
    ...Typography.captionBold,
    color: Colors.slate800,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Typography.body,
    color: Colors.slate900,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: Colors.slate100,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.slate200,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  categoryChipText: {
    ...Typography.caption,
    color: Colors.slate700,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#0369a1',
    fontWeight: '800',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.slate100,
    ...Typography.bodyBold,
    color: Colors.slate700,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  phoneInputBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Typography.body,
    color: Colors.slate900,
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
    borderRadius: BorderRadius.sm,
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
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  gpsCoordinatesText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  gpsHelpText: {
    ...Typography.caption,
    color: Colors.textMuted,
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
    backgroundColor: Colors.slate100,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.slate200,
  },
  radiusBtnActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  radiusBtnText: {
    ...Typography.caption,
    color: Colors.slate700,
    fontWeight: '600',
  },
  radiusBtnTextActive: {
    color: '#b45309',
    fontWeight: '800',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    paddingTop: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.slate100,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalCancelText: {
    ...Typography.bodyBold,
    color: Colors.slate700,
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#ff8a16',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalSubmitText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  dispatchSettingsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginBottom: Spacing.sm,
  },
  dispatchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dispatchTitle: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    fontWeight: '800',
  },
  dispatchRadiusBadge: {
    backgroundColor: Colors.slate900,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  dispatchRadiusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  dispatchSub: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: Spacing.md,
  },
  radiusSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  radiusChipActive: {
    backgroundColor: Colors.slate900,
    borderColor: Colors.slate900,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate700,
  },
  radiusChipTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  riderRadiusMeta: {
    ...Typography.captionBold,
    color: '#0369a1',
    marginTop: 3,
  },
  riderGpsMeta: {
    ...Typography.caption,
    color: Colors.slate500,
    marginTop: 2,
  },
});
