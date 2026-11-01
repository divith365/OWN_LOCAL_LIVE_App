import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { apiClient } from '../../src/api';

export default function MerchantDashboardScreen() {
  const merchantId = 'merch_ayodhya'; // Ayodhya Hotel Demo Merchant
  const [isOpen, setIsOpen] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      // In production/Phase 5 this filters by merchant_id
      const res = await apiClient.getOrder('ord_mock'); // Fallback or test
      // Mock active order if none in DB yet
      setOrders([
        {
          id: 'ord_demo_01',
          order_number: 'ILK-8421',
          status: 'MERCHANT_CONFIRMATION_PENDING',
          customer_name: 'Ramesh Kulkarni',
          items: [
            { product_name: 'Puri Plate (3 pcs)', quantity: 2, unit_price: 50 },
            { product_name: 'Filter Coffee', quantity: 2, unit_price: 20 },
          ],
          grand_total: 170,
          delivery_address: 'Near Vijaya Mahantesh Temple, Ilkal',
          delivery_type: 'PLATFORM_RIDER',
        },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId: string, nextStatus: any, label: string) => {
    setProcessingId(orderId);
    try {
      const res = await apiClient.updateOrderStatus(orderId, nextStatus, `Updated by Ayodhya Hotel (${label})`);
      if (res.success || res.error?.code === 'NOT_FOUND') {
        // Optimistically update local view for demo
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
        Alert.alert('Status Updated', `Order marked as ${label}`);
      } else {
        Alert.alert('Transition Error', res.error?.message || 'Cannot update status');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Merchant Info Banner */}
      <View style={styles.merchantHeader}>
        <View style={styles.storeRow}>
          <View>
            <Text style={styles.storeName}>Ayodhya Hotel</Text>
            <Text style={styles.storeCategory}>Food & Dining • Ilkal Main Road</Text>
          </View>
          <View style={styles.toggleBox}>
            <Text style={[styles.toggleLabel, { color: isOpen ? Colors.success : Colors.danger }]}>
              {isOpen ? 'ONLINE' : 'OFFLINE'}
            </Text>
            <Switch
              value={isOpen}
              onValueChange={setIsOpen}
              trackColor={{ false: Colors.slate300, true: Colors.successLight }}
              thumbColor={isOpen ? Colors.success : Colors.slate400}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Today's Orders</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>₹3,420</Text>
            <Text style={styles.statLabel}>Gross Sales</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>4.8 ★</Text>
            <Text style={styles.statLabel}>Store Rating</Text>
          </View>
        </View>
      </View>

      {/* Orders Section */}
      <Text style={styles.sectionHeading}>Incoming & Active Orders</Text>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No pending orders right now.</Text>
        </View>
      ) : (
        orders.map((order) => {
          const statusConfig = getOrderStatusConfig(order.status);
          const isPendingConfirm = order.status === 'MERCHANT_CONFIRMATION_PENDING';
          const isConfirmed = order.status === 'MERCHANT_CONFIRMED' || order.status === 'PREPARING';

          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderCardHeader}>
                <View>
                  <Text style={styles.orderNumberText}>{order.order_number}</Text>
                  <Text style={styles.customerText}>Customer: {order.customer_name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Items List */}
              <View style={styles.itemsList}>
                {order.items.map((item: any, idx: number) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.itemPrice}>₹{item.quantity * item.unit_price}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.orderFooterRow}>
                <Text style={styles.totalText}>Total: ₹{order.grand_total}</Text>
                <Text style={styles.deliveryTypeText}>🛵 {order.delivery_type}</Text>
              </View>

              {/* Action Buttons with State Machine rules */}
              <View style={styles.actionsRow}>
                {isPendingConfirm && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      disabled={processingId === order.id}
                      onPress={() => handleUpdateStatus(order.id, 'MERCHANT_REJECTED', 'Rejected')}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.acceptBtn]}
                      disabled={processingId === order.id}
                      onPress={() => handleUpdateStatus(order.id, 'MERCHANT_CONFIRMED', 'Confirmed')}
                    >
                      {processingId === order.id ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <Text style={styles.acceptBtnText}>Accept Order</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {isConfirmed && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.readyBtn]}
                    disabled={processingId === order.id}
                    onPress={() => handleUpdateStatus(order.id, 'READY_FOR_PICKUP', 'Ready for Pickup')}
                  >
                    <Text style={styles.readyBtnText}>Mark Food Ready for Pickup →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  merchantHeader: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeName: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  storeCategory: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  toggleBox: {
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  emptyBox: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.subhead,
    color: Colors.textMuted,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumberText: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    fontSize: 16,
  },
  customerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.slate100,
    marginVertical: Spacing.md,
  },
  itemsList: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQuantity: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.primaryDark,
    width: 24,
  },
  itemName: {
    ...Typography.subhead,
    color: Colors.slate800,
    flex: 1,
  },
  itemPrice: {
    ...Typography.subhead,
    color: Colors.slate700,
    fontWeight: '600',
  },
  orderFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalText: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  deliveryTypeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.dangerLight,
  },
  rejectBtnText: {
    ...Typography.bodyBold,
    color: Colors.danger,
    fontSize: 14,
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontSize: 14,
  },
  readyBtn: {
    backgroundColor: Colors.secondaryDark,
  },
  readyBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontSize: 14,
  },
});
