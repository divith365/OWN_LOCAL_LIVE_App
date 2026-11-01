import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Vibration,
} from 'react-native';
import * as Location from 'expo-location';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api';
import { OrderStatus } from '@ownlocal/types';
import { BrandHeader } from '../../src/components/BrandHeader';
import { startBackgroundRiderTracking, stopBackgroundRiderTracking } from '../../src/services/riderLocationService';
import { triggerLocalOrderAlert, syncPushTokenWithBackend } from '../../src/services/notificationService';

export default function RiderConsoleScreen() {
  const [rider, setRider] = useState<any>(null);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({ trips_today: 0, earnings_today: 0, on_time_rate: '98%' });
  const [isOnline, setIsOnline] = useState(true);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);
  const [gpsRefreshing, setGpsRefreshing] = useState(false);
  const [preferredRadius, setPreferredRadius] = useState<number>(3.0);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number }>({ lat: 15.9585, lng: 76.126 });

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevJobCountRef = useRef<number>(0);

  const fetchRiderData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiClient.getRiderConsole('rider_01');
      if (res.success && res.data) {
        setRider(res.data.rider);
        if (res.data.rider?.id) {
          syncPushTokenWithBackend({ riderId: res.data.rider.id, role: 'RIDER' }).catch(() => null);
        }
        setActiveJob(res.data.activeJob);
        const newJobs = res.data.availableJobs || [];
        setAvailableJobs(newJobs);
        if (res.data.metrics) setMetrics(res.data.metrics);
        setIsOnline(Boolean(res.data.rider?.online_status));
        if (res.data.rider?.preferred_radius_km) {
          setPreferredRadius(Number(res.data.rider.preferred_radius_km));
        } else if (res.data.dispatch_settings?.rider_preferred_radius_km) {
          setPreferredRadius(Number(res.data.dispatch_settings.rider_preferred_radius_km));
        }

        // Chime and vibrate if a new job offer arrives
        if (newJobs.length > prevJobCountRef.current && prevJobCountRef.current !== 0) {
          Vibration.vibrate([0, 400, 200, 400]);
          triggerLocalOrderAlert('🛵 New Delivery Job Available!', `A new order is available for pickup near you (Payout: ₹35).`);
        }
        prevJobCountRef.current = newJobs.length;
      }
    } catch (e) {
      console.error('Failed to fetch rider console', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initialize native GPS and start location updates
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          apiClient.riderUpdateLocation(loc.coords.latitude, loc.coords.longitude, 'rider_01');
        }
      } catch (err) {
        console.warn('GPS location error', err);
      }
    })();
  }, []);

  const handleRefreshGps = async () => {
    setGpsRefreshing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow location permission to update your GPS position.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      await apiClient.riderUpdateLocation(loc.coords.latitude, loc.coords.longitude, rider?.id || 'rider_01');
      Alert.alert(
        'GPS Position Refreshed! 📍',
        `Coordinates: ${loc.coords.latitude.toFixed(4)}° N, ${loc.coords.longitude.toFixed(4)}° E.\nNearby pickup orders updated for your location.`
      );
      fetchRiderData(false);
    } catch (err: any) {
      Alert.alert('GPS Error', err?.message || 'Could not fetch current GPS coordinates.');
    } finally {
      setGpsRefreshing(false);
    }
  };

  const handleSelectRadius = async (radiusKm: number) => {
    setPreferredRadius(radiusKm);
    setSavingRadius(true);
    try {
      const res = await apiClient.updateRiderSettings(radiusKm, rider?.id || 'rider_01');
      if (res.success) {
        Alert.alert(
          'Preferred Radius Updated! 🛵',
          `You will now receive order pickup offers from merchants within ${radiusKm} km of your GPS location.`
        );
        fetchRiderData(false);
      } else {
        Alert.alert('Error', res.error?.message || 'Could not update dispatch radius.');
      }
    } catch (err: any) {
      Alert.alert('Network Error', err?.message || 'Failed to save radius preference.');
    } finally {
      setSavingRadius(false);
    }
  };

  useEffect(() => {
    fetchRiderData(false);

    // Auto-poll dispatch assignments every 4 seconds
    pollTimerRef.current = setInterval(() => {
      fetchRiderData(false);
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchRiderData]);

  const handleToggleDuty = async (val: boolean) => {
    setIsOnline(val);
    try {
      await apiClient.riderToggleDuty(val, rider?.id || 'rider_01');
      if (val) {
        startBackgroundRiderTracking(rider?.id || 'rider_01').catch((e) => console.warn('Background tracking not started:', e));
      } else {
        stopBackgroundRiderTracking().catch((e) => console.warn('Background tracking not stopped:', e));
      }
    } catch {
      setIsOnline(!val);
    }
  };

  const handleAcceptJob = async (orderId: string) => {
    setActionLoading(true);
    try {
      const res = await apiClient.riderAcceptJob(orderId, rider?.id || 'rider_01');
      if (res.success) {
        Alert.alert('Job Accepted!', 'Head over to the merchant store to collect the parcel.');
        fetchRiderData(false);
      } else {
        Alert.alert('Unavailable', res.error?.message || 'Could not claim delivery job');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to claim job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!activeJob) return;
    setActionLoading(true);
    try {
      const res = await apiClient.riderPickupJob(activeJob.id);
      if (res.success) {
        Alert.alert(
          'Pickup Confirmed!',
          'Package collected from store. En route to customer delivery location.'
        );
        fetchRiderData(false);
      } else {
        Alert.alert('Error', res.error?.message || 'Could not confirm pickup');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to confirm pickup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDelivery = async () => {
    if (!activeJob) return;
    if (deliveryOtpInput.trim().length !== 4) {
      Alert.alert('Invalid OTP', 'Please ask the customer for their 4-digit Delivery OTP.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiClient.verifyDeliveryOtp(activeJob.id, deliveryOtpInput.trim());
      if (res.success && res.data?.verified) {
        Alert.alert(
          '🎉 Delivery Completed!',
          'OTP successfully verified! Delivery fee credited to your wallet.'
        );
        setDeliveryOtpInput('');
        fetchRiderData(false);
      } else {
        Alert.alert('Invalid OTP', res.error?.message || 'The OTP entered does not match.');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Could not verify delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const openNavigation = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address + ', Ilkal, Karnataka'
    )}`;
    Linking.openURL(url);
  };

  const makeCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Number', 'Contact phone number not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to Ilkal Rider Dispatch...</Text>
      </View>
    );
  }

  const statusConfig = activeJob ? getOrderStatusConfig(activeJob.status as OrderStatus) : null;
  const isEnRoute = activeJob?.status === 'OUT_FOR_DELIVERY';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
      <BrandHeader currentRole="rider" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchRiderData(true)} />}
      >
      {/* Rider Duty Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.profileRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{rider?.name || 'Manjunath Badiger'}</Text>
            <Text style={styles.vehicleInfo}>
              🛵 {rider?.vehicle_number || 'KA-29-EE-4521'} • {rider?.vehicle_type || 'bike'}
            </Text>
            <View style={styles.gpsRow}>
              <Text style={styles.gpsCoord}>
                📍 {gpsCoords.lat.toFixed(4)}° N, {gpsCoords.lng.toFixed(4)}° E
              </Text>
              <TouchableOpacity
                style={styles.gpsSyncBtn}
                disabled={gpsRefreshing}
                onPress={handleRefreshGps}
              >
                {gpsRefreshing ? (
                  <ActivityIndicator size="small" color="#0369a1" />
                ) : (
                  <Text style={styles.gpsSyncText}>🔄 Refresh GPS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dutyBox}>
            <Text style={[styles.dutyText, { color: isOnline ? Colors.success : Colors.danger }]}>
              {isOnline ? 'ON DUTY' : 'OFF DUTY'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={handleToggleDuty}
              trackColor={{ false: Colors.slate300, true: Colors.successLight }}
              thumbColor={isOnline ? Colors.success : Colors.slate400}
            />
          </View>
        </View>

        {/* Operating Dispatch Radius Customizer (Rider Choice) */}
        <View style={styles.radiusBox}>
          <View style={styles.radiusHeader}>
            <Text style={styles.radiusTitle}>🛵 Preferred Pickup Radius</Text>
            <View style={styles.radiusBadge}>
              <Text style={styles.radiusBadgeText}>{preferredRadius} km</Text>
            </View>
          </View>
          <Text style={styles.radiusHelp}>
            Matching store pickups within {preferredRadius} km of your GPS location
          </Text>
          <View style={styles.radiusChips}>
            {[2, 3, 5, 8, 10].map((km) => (
              <TouchableOpacity
                key={km}
                style={[styles.radiusChip, preferredRadius === km && styles.radiusChipActive]}
                disabled={savingRadius}
                onPress={() => handleSelectRadius(km)}
              >
                <Text style={[styles.radiusChipText, preferredRadius === km && styles.radiusChipTextActive]}>
                  {km} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Rider Metrics */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{metrics.trips_today}</Text>
            <Text style={styles.statLbl}>Trips Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>₹{metrics.earnings_today}</Text>
            <Text style={styles.statLbl}>Earnings</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{metrics.on_time_rate}</Text>
            <Text style={styles.statLbl}>On-Time</Text>
          </View>
        </View>
      </View>

      {/* Offline Alert Banner */}
      {!isOnline && (
        <View style={styles.offlineAlert}>
          <Text style={styles.offlineAlertIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineAlertTitle}>You are currently OFFLINE</Text>
            <Text style={styles.offlineAlertSub}>
              Switch ON DUTY above to receive orders matching within {preferredRadius} km of your location.
            </Text>
          </View>
        </View>
      )}

      {/* Active Trip Assignment Section */}
      <Text style={styles.sectionHeading}>Current Trip Assignment</Text>

      {activeJob ? (
        <View style={styles.jobCard}>
          {/* Header */}
          <View style={styles.jobHeader}>
            <View>
              <Text style={styles.jobOrderNumber}>{activeJob.order_number}</Text>
              <Text style={styles.payoutText}>Payout: ₹35.00</Text>
            </View>
            {statusConfig && (
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                  {statusConfig.label}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Pickup Store Card */}
          <View style={styles.routePoint}>
            <Text style={styles.pointDot}>🟢</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointLabel}>PICKUP FROM</Text>
              <Text style={styles.pointName}>{activeJob.merchant_name || 'Store'}</Text>
              <Text style={styles.pointAddress}>📍 {activeJob.merchant_address || 'Ilkal'}</Text>
            </View>
            <View style={styles.pointActionRow}>
              {activeJob.merchant_phone && (
                <TouchableOpacity
                  style={styles.iconCircle}
                  onPress={() => makeCall(activeJob.merchant_phone)}
                >
                  <Text style={styles.iconText}>📞</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => openNavigation(activeJob.merchant_address || activeJob.merchant_name)}
              >
                <Text style={styles.iconText}>🧭</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Delivery Destination Card */}
          <View style={styles.routePoint}>
            <Text style={styles.pointDot}>🔴</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointLabel}>DELIVER TO</Text>
              <Text style={styles.pointName}>Customer Destination</Text>
              <Text style={styles.pointAddress}>📍 {activeJob.delivery_address}</Text>
            </View>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={() => openNavigation(activeJob.delivery_address)}
            >
              <Text style={styles.iconText}>🧭</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Items Summary */}
          <Text style={styles.itemsHeader}>Items ({activeJob.items?.length || 0}):</Text>
          {(activeJob.items || []).map((item: any, idx: number) => (
            <Text key={idx} style={styles.itemLine}>
              • {item.quantity}x {item.product_name}
            </Text>
          ))}

          {/* Step 1: Collect from Merchant */}
          {!isEnRoute && (
            <TouchableOpacity
              style={styles.pickupActionBtn}
              disabled={actionLoading}
              onPress={handleConfirmPickup}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.actionBtnText}>Confirm Pickup & Start Delivery 🚀</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Step 2: Customer Handshake with OTP Verification */}
          {isEnRoute && (
            <View style={styles.otpVerificationBox}>
              <Text style={styles.otpVerifyTitle}>🔒 Customer Delivery Handshake</Text>
              <Text style={styles.otpVerifySub}>
                Ask the customer for their 4-digit Delivery OTP shown on their screen:
              </Text>

              <TextInput
                style={styles.otpInput}
                placeholder="4-digit OTP"
                keyboardType="number-pad"
                maxLength={4}
                value={deliveryOtpInput}
                onChangeText={setDeliveryOtpInput}
                placeholderTextColor={Colors.textMuted}
              />

              <TouchableOpacity
                style={styles.verifyBtn}
                disabled={actionLoading}
                onPress={handleVerifyDelivery}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>Verify OTP & Complete Delivery ✓</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noJobBox}>
          <Text style={styles.noJobEmoji}>🛵</Text>
          <Text style={styles.noJobTitle}>No Active Delivery Right Now</Text>
          <Text style={styles.noJobSub}>
            Check available orders within your {preferredRadius} km radius below!
          </Text>
        </View>
      )}

      {/* Available Delivery Jobs in Ilkal */}
      <Text style={styles.sectionHeading}>
        Available Jobs in Your Area ({availableJobs.length})
      </Text>

      {availableJobs.length === 0 ? (
        <View style={styles.emptyPoolBox}>
          <Text style={styles.emptyPoolText}>
            {isOnline
              ? `No unassigned orders found within ${preferredRadius} km of your GPS location. New jobs will appear here in real-time.`
              : 'You are currently offline. Switch on duty to view available pickup offers.'}
          </Text>
        </View>
      ) : (
        availableJobs.map((job) => (
          <View key={job.id} style={styles.poolCard}>
            <View style={styles.poolTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.poolStoreName}>{job.merchant_name}</Text>
                <Text style={styles.poolOrderNumber}>Order #{job.order_number}</Text>
              </View>
              <View style={styles.payoutBadge}>
                <Text style={styles.payoutBadgeText}>Earn ₹{job.earnings || 35}</Text>
              </View>
            </View>

            {/* Distance Indicators (Merchant-to-Rider & Merchant-to-Customer) */}
            <View style={styles.distanceRow}>
              <View style={styles.distPillStore}>
                <Text style={styles.distPillStoreText}>📍 {job.pickup_distance_km ?? 0.6} km to pickup</Text>
              </View>
              <View style={styles.distPillDrop}>
                <Text style={styles.distPillDropText}>🏁 {job.drop_distance_km ?? 1.4} km to drop</Text>
              </View>
            </View>

            <Text style={styles.poolAddress}>🏬 Store: {job.merchant_address}</Text>
            <Text style={styles.poolAddress}>🏠 Drop: {job.delivery_address}</Text>

            {job.items_summary && (
              <Text style={styles.poolItems}>🛍️ {job.items_summary}</Text>
            )}

            <TouchableOpacity
              style={[styles.claimBtn, !isOnline && styles.claimBtnDisabled]}
              disabled={actionLoading || !isOnline}
              onPress={() => handleAcceptJob(job.id)}
            >
              <Text style={styles.claimBtnText}>
                {isOnline ? 'Accept Delivery Job →' : 'Go On Duty to Accept'}
              </Text>
            </TouchableOpacity>
          </View>
        ))
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
  profileCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  riderName: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  vehicleInfo: {
    ...Typography.subheadBold,
    color: Colors.slate700,
    marginTop: 2,
  },
  gpsCoord: {
    ...Typography.caption,
    color: Colors.primaryDark,
    marginTop: 4,
  },
  dutyBox: {
    alignItems: 'center',
  },
  dutyText: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  statLbl: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
    marginTop: Spacing.sm,
  },
  jobCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobOrderNumber: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  payoutText: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    ...Typography.captionBold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.slate100,
    marginVertical: Spacing.md,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: Spacing.md,
  },
  pointDot: {
    fontSize: 14,
    marginTop: 2,
  },
  pointLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  pointName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  pointAddress: {
    ...Typography.subhead,
    color: Colors.slate600,
    marginTop: 2,
  },
  pointActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  iconText: {
    fontSize: 16,
  },
  itemsHeader: {
    ...Typography.captionBold,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  itemLine: {
    ...Typography.subhead,
    color: Colors.slate700,
    marginLeft: 6,
  },
  pickupActionBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  actionBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  otpVerificationBox: {
    backgroundColor: Colors.primaryTint,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  otpVerifyTitle: {
    ...Typography.bodyBold,
    color: Colors.primaryDark,
  },
  otpVerifySub: {
    ...Typography.caption,
    color: Colors.slate700,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  otpInput: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    width: 180,
    color: Colors.slate900,
    marginBottom: Spacing.md,
  },
  verifyBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  noJobBox: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noJobEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  noJobTitle: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  noJobSub: {
    ...Typography.subhead,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  emptyPoolBox: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyPoolText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  poolCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  poolTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  poolStoreName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  poolOrderNumber: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  payoutBadge: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  payoutBadgeText: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
  },
  poolAddress: {
    ...Typography.subhead,
    color: Colors.slate700,
    marginTop: 2,
  },
  claimBtn: {
    backgroundColor: Colors.slate900,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  claimBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  claimBtnDisabled: {
    backgroundColor: Colors.slate400,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  gpsSyncBtn: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  gpsSyncText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  radiusBox: {
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radiusTitle: {
    ...Typography.captionBold,
    color: Colors.slate900,
  },
  radiusBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  radiusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  radiusHelp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  radiusChips: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusChip: {
    flex: 1,
    paddingVertical: 6,
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
    fontWeight: '600',
    color: Colors.slate700,
  },
  radiusChipTextActive: {
    color: Colors.white,
    fontWeight: '800',
  },
  offlineAlert: {
    backgroundColor: '#fffbeb',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offlineAlertIcon: {
    fontSize: 22,
  },
  offlineAlertTitle: {
    ...Typography.captionBold,
    color: '#92400e',
  },
  offlineAlertSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  distPillStore: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  distPillStoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  distPillDrop: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  distPillDropText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
  },
  poolItems: {
    ...Typography.caption,
    color: Colors.slate600,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
