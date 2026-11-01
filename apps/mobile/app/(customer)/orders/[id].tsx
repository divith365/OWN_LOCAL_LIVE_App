import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { apiClient } from '../../../src/api';
import { OrderStatus } from '@ownlocal/types';

// Steps in delivery lifecycle
const ORDER_STEPS: Array<{ key: string; label: string; icon: string; matchStatuses: OrderStatus[] }> = [
  {
    key: 'placed',
    label: 'Order Placed',
    icon: '📝',
    matchStatuses: ['CREATED', 'MERCHANT_CONFIRMATION_PENDING'],
  },
  {
    key: 'confirmed',
    label: 'Confirmed & Prep',
    icon: '🍳',
    matchStatuses: ['MERCHANT_CONFIRMED', 'PAYMENT_CONFIRMED', 'PREPARING'],
  },
  {
    key: 'assigned',
    label: 'Rider Assigned',
    icon: '🛵',
    matchStatuses: ['RIDER_ASSIGNMENT_PENDING', 'RIDER_ASSIGNED', 'READY_FOR_PICKUP', 'PICKED_UP'],
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    icon: '🚀',
    matchStatuses: ['OUT_FOR_DELIVERY'],
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: '✅',
    matchStatuses: ['DELIVERED'],
  },
];

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrder = useCallback(
    async (showSpinner = false) => {
      if (!id) return;
      if (showSpinner) setRefreshing(true);
      try {
        const res = await apiClient.getOrder(id);
        if (res.success && res.data) {
          setOrder(res.data);
        }
      } catch (e) {
        console.error('Failed to poll order', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchOrder(false);

    // Auto poll every 4 seconds if order is in an active non-terminal state
    pollTimerRef.current = setInterval(() => {
      if (
        order &&
        !['DELIVERED', 'CUSTOMER_CANCELLED', 'MERCHANT_REJECTED', 'FAILED'].includes(
          order.status
        )
      ) {
        fetchOrder(false);
      }
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchOrder, order?.status]);

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const res = await apiClient.cancelOrder(id as string, 'Customer requested cancellation');
              if (res.success) {
                Alert.alert('Order Cancelled', 'Your order was cancelled successfully.');
                fetchOrder(false);
              } else {
                Alert.alert('Could Not Cancel', res.error?.message || 'Cancellation failed.');
              }
            } catch (err: any) {
              Alert.alert('Network Error', err?.message || 'Failed to cancel order.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('No Phone', 'Phone number is not available.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Fetching live order status...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.notFoundText}>Order not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = getOrderStatusConfig(order.status as OrderStatus);
  const isCancelled = ['CUSTOMER_CANCELLED', 'MERCHANT_REJECTED', 'FAILED'].includes(order.status);
  const isDelivered = order.status === 'DELIVERED';
  const canCancel = ['CREATED', 'MERCHANT_CONFIRMATION_PENDING'].includes(order.status);

  // Compute active step index for progress bar
  let currentStepIndex = 0;
  if (['CREATED', 'MERCHANT_CONFIRMATION_PENDING'].includes(order.status)) currentStepIndex = 0;
  else if (['MERCHANT_CONFIRMED', 'PAYMENT_CONFIRMED', 'PREPARING'].includes(order.status)) currentStepIndex = 1;
  else if (['RIDER_ASSIGNMENT_PENDING', 'RIDER_ASSIGNED', 'READY_FOR_PICKUP', 'PICKED_UP'].includes(order.status)) currentStepIndex = 2;
  else if (order.status === 'OUT_FOR_DELIVERY') currentStepIndex = 3;
  else if (order.status === 'DELIVERED') currentStepIndex = 4;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Header Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.orderNumberLabel}>ORDER NUMBER</Text>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Cancellation notice */}
          {isCancelled && (
            <View style={styles.cancelledBanner}>
              <Text style={styles.cancelledText}>
                ⚠️ This order was {statusConfig.label.toLowerCase()}. If payment was deducted, refund is initiated automatically.
              </Text>
            </View>
          )}

          {/* Live Timeline Stepper (if not cancelled) */}
          {!isCancelled && (
            <View style={styles.timelineContainer}>
              <View style={styles.stepperRow}>
                {ORDER_STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <View key={step.key} style={styles.stepCol}>
                      <View
                        style={[
                          styles.stepCircle,
                          isDone && styles.stepCircleDone,
                          isCurrent && styles.stepCircleCurrent,
                        ]}
                      >
                        <Text style={styles.stepIcon}>{step.icon}</Text>
                      </View>
                      <Text
                        style={[
                          styles.stepLabel,
                          isDone && styles.stepLabelDone,
                          isCurrent && styles.stepLabelCurrent,
                        ]}
                        numberOfLines={1}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Celebration Banner when Merchant Confirmed */}
        {['MERCHANT_CONFIRMED', 'PREPARING'].includes(order.status) && (
          <View style={styles.celebrationCard}>
            <View style={styles.celebrationLeft}>
              <View style={styles.celebrationIconBox}>
                <Text style={styles.celebrationIcon}>🎉</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.celebrationBadgeRow}>
                  <Text style={styles.celebrationBadge}>STORE CONFIRMED</Text>
                  <Text style={styles.celebrationSparkle}>✨</Text>
                </View>
                <Text style={styles.celebrationTitle}>Good news! Store confirmed your order</Text>
                <Text style={styles.celebrationSubtitle}>
                  {order.merchant_name || 'Ayodhya Hotel'} accepted your dishes and kitchen preparation has started.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Delivery OTP Card (Crucial Security Handshake) */}
        {!isCancelled && !isDelivered && (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>🔒 Delivery Verification OTP</Text>
              <Text style={styles.otpBadge}>Confidential</Text>
            </View>

            <View style={styles.otpCodeContainer}>
              <Text style={styles.otpCode}>{order.delivery_otp}</Text>
            </View>

            <Text style={styles.otpInstruction}>
              Share this 4-digit code with the rider only after receiving your items at your doorstep.
            </Text>
          </View>
        )}

        {/* Merchant Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>Store Details</Text>
          <View style={styles.partnerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerName}>{order.merchant_name || 'Ilkal Merchant'}</Text>
              <Text style={styles.partnerAddress}>📍 {order.merchant_address || 'Ilkal, Karnataka'}</Text>
            </View>
            {order.merchant_phone && (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(order.merchant_phone)}
              >
                <Text style={styles.callIcon}>📞</Text>
                <Text style={styles.callText}>Call Store</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Rider Card (when assigned) */}
        {order.rider_id && (
          <View style={styles.infoCard}>
            <Text style={styles.cardHeader}>Delivery Partner</Text>
            <View style={styles.partnerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerName}>{order.rider_name || 'Assigned Rider'}</Text>
                <Text style={styles.partnerAddress}>
                  🛵 {order.rider_vehicle_number || 'KA-29 Delivery Bike'}
                </Text>
              </View>
              {order.rider_phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(order.rider_phone)}
                >
                  <Text style={styles.callIcon}>📞</Text>
                  <Text style={styles.callText}>Call Rider</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Delivery Address Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>Delivery Address</Text>
          <Text style={styles.addressText}>📍 {order.delivery_address}</Text>
          <Text style={styles.deliveryTypeText}>
            Type:{' '}
            <Text style={{ fontWeight: '700' }}>
              {order.delivery_type === 'STORE_PICKUP'
                ? 'Store Self-Pickup'
                : order.delivery_type === 'MERCHANT_SELF'
                ? 'Direct Merchant Delivery'
                : 'Platform Rider Assured'}
            </Text>
          </Text>
        </View>

        {/* Order Items */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>Items in Order ({order.items?.length || 0})</Text>
          {(order.items || []).map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemMeta}>
                  ₹{item.unit_price} × {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemTotal}>₹{item.total_price}</Text>
            </View>
          ))}

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{order.item_total}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValue}>₹{order.delivery_fee}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform Fee</Text>
            <Text style={styles.billValue}>₹{order.platform_fee}</Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>₹{order.grand_total}</Text>
          </View>

          <View style={styles.paymentInfoRow}>
            <Text style={styles.paymentMethodText}>
              Payment: <Text style={{ fontWeight: '700' }}>{order.payment_method}</Text> (
              {order.payment_status})
            </Text>
          </View>
        </View>

        {/* Status Timeline History Log */}
        {order.history && order.history.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.cardHeader}>Activity Log</Text>
            {order.history.map((hist: any) => {
              const histConfig = getOrderStatusConfig(hist.to_status);
              return (
                <View key={hist.id} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyStatus}>{histConfig.label}</Text>
                    {hist.notes ? <Text style={styles.historyNotes}>{hist.notes}</Text> : null}
                    <Text style={styles.historyTime}>{hist.created_at}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Cancel Order Action */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelActionBtn}
            disabled={cancelling}
            onPress={handleCancelOrder}
          >
            {cancelling ? (
              <ActivityIndicator color={Colors.danger} size="small" />
            ) : (
              <Text style={styles.cancelActionText}>Cancel Order</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Floating Refresh Bar */}
      <View style={styles.floatingBottomBar}>
        <TouchableOpacity
          style={styles.refreshBtn}
          disabled={refreshing}
          onPress={() => fetchOrder(true)}
        >
          {refreshing ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.refreshBtnText}>🔄 Refresh Status</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(customer)')}
        >
          <Text style={styles.homeBtnText}>Marketplace</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: Spacing.md,
  },
  notFoundText: {
    ...Typography.title2,
    color: Colors.slate900,
    marginBottom: Spacing.md,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  backBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 110,
    gap: Spacing.md,
  },
  heroCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  orderNumber: {
    ...Typography.title2,
    color: Colors.slate900,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    ...Typography.captionBold,
  },
  cancelledBanner: {
    backgroundColor: Colors.dangerLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  cancelledText: {
    ...Typography.caption,
    color: Colors.danger,
    lineHeight: 18,
  },
  timelineContainer: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepCol: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCircleDone: {
    backgroundColor: Colors.primaryTint,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  stepCircleCurrent: {
    backgroundColor: Colors.primary,
  },
  stepIcon: {
    fontSize: 16,
  },
  stepLabel: {
    fontSize: 10,
    color: Colors.slate400,
    textAlign: 'center',
  },
  stepLabelDone: {
    color: Colors.slate700,
    fontWeight: '600',
  },
  stepLabelCurrent: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  otpCard: {
    backgroundColor: Colors.primaryTint,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  otpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  otpTitle: {
    ...Typography.bodyBold,
    color: Colors.primaryDark,
  },
  otpBadge: {
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    fontSize: 10,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  otpCodeContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.sm,
  },
  otpCode: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 8,
    color: Colors.primaryDark,
  },
  otpInstruction: {
    ...Typography.caption,
    color: Colors.slate700,
    textAlign: 'center',
    lineHeight: 16,
  },
  infoCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    marginBottom: Spacing.md,
  },
  partnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerName: {
    ...Typography.subheadBold,
    color: Colors.slate900,
  },
  partnerAddress: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 4,
  },
  callIcon: {
    fontSize: 14,
  },
  callText: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
  },
  addressText: {
    ...Typography.subhead,
    color: Colors.slate800,
    lineHeight: 20,
  },
  deliveryTypeText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemName: {
    ...Typography.subheadBold,
    color: Colors.slate900,
  },
  itemMeta: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemTotal: {
    ...Typography.subheadBold,
    color: Colors.slate900,
  },
  billDivider: {
    height: 1,
    backgroundColor: Colors.slate200,
    marginVertical: Spacing.sm,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  billLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  billValue: {
    ...Typography.captionBold,
    color: Colors.slate800,
  },
  grandTotalLabel: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  grandTotalValue: {
    ...Typography.title3,
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  paymentInfoRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
  },
  paymentMethodText: {
    ...Typography.caption,
    color: Colors.slate600,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  historyStatus: {
    ...Typography.captionBold,
    color: Colors.slate800,
  },
  historyNotes: {
    ...Typography.caption,
    color: Colors.slate600,
  },
  historyTime: {
    fontSize: 10,
    color: Colors.slate400,
    marginTop: 2,
  },
  cancelActionBtn: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelActionText: {
    ...Typography.bodyBold,
    color: Colors.danger,
  },
  floatingBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  refreshBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  refreshBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  homeBtn: {
    backgroundColor: Colors.slate100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  homeBtnText: {
    ...Typography.bodyBold,
    color: Colors.slate700,
  },
  celebrationCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#86efac',
    padding: Spacing.md,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  celebrationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  celebrationIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationIcon: {
    fontSize: 22,
  },
  celebrationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  celebrationBadge: {
    backgroundColor: '#16a34a',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  celebrationSparkle: {
    fontSize: 14,
  },
  celebrationTitle: {
    ...Typography.subheadBold,
    color: '#14532d',
    marginBottom: 2,
  },
  celebrationSubtitle: {
    ...Typography.caption,
    color: '#166534',
    lineHeight: 18,
  },
});
