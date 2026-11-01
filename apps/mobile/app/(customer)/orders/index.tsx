import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { apiClient } from '../../../src/api';
import { OrderStatus } from '@ownlocal/types';

export default function CustomerOrdersListScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.getCustomerOrders();
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptySubtitle}>
              You haven't placed any orders in Ilkal yet. Explore local stores and authentic food!
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.replace('/(customer)')}
            >
              <Text style={styles.browseBtnText}>Explore Stores →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.orderList}>
            {orders.map((order) => {
              const statusConfig = getOrderStatusConfig(order.status as OrderStatus);
              const isActive = !['DELIVERED', 'CUSTOMER_CANCELLED', 'MERCHANT_REJECTED', 'FAILED'].includes(
                order.status
              );

              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, isActive && styles.orderCardActive]}
                  onPress={() => router.push(`/(customer)/orders/${order.id}` as any)}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.merchantName}>{order.merchant_name || 'Ilkal Store'}</Text>
                      <Text style={styles.orderNumber}>{order.order_number}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Text style={[styles.statusText, { color: statusConfig.text }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaDate}>📅 {order.created_at}</Text>
                    <Text style={styles.orderTotal}>₹{order.grand_total}</Text>
                  </View>

                  {isActive && order.delivery_otp && (
                    <View style={styles.otpBanner}>
                      <Text style={styles.otpBannerText}>
                        Delivery OTP: <Text style={{ fontWeight: '800' }}>{order.delivery_otp}</Text>
                      </Text>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.trackText}>
                      {isActive ? '🔴 Live Tracking →' : 'View Order Details →'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
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
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 12,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: 12,
  },
  emptyTitle: {
    ...Typography.title2,
    color: Colors.slate900,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...Typography.subhead,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  browseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  browseBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  orderList: {
    gap: Spacing.md,
  },
  orderCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderCardActive: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  merchantName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  orderNumber: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.captionBold,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
  },
  metaDate: {
    ...Typography.caption,
    color: Colors.slate600,
  },
  orderTotal: {
    ...Typography.bodyBold,
    color: Colors.primaryDark,
    fontSize: 16,
  },
  otpBanner: {
    backgroundColor: Colors.primaryTint,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  otpBannerText: {
    ...Typography.caption,
    color: Colors.primaryDark,
  },
  cardFooter: {
    marginTop: Spacing.sm,
    alignItems: 'flex-end',
  },
  trackText: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
  },
});
