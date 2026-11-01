import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api';
import { OrderStatus, Product } from '@ownlocal/types';
import { BrandHeader } from '../../src/components/BrandHeader';

export default function MerchantDashboardScreen() {
  const [merchant, setMerchant] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [togglingStockId, setTogglingStockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'INCOMING' | 'PREPARING' | 'COMPLETED' | 'STOCK'>('INCOMING');
  const [celebrationModal, setCelebrationModal] = useState<{
    visible: boolean;
    orderNumber: string;
    prepTime: number;
  } | null>(null);

  const prevPendingCountRef = useRef<number>(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await apiClient.getMerchantDashboard('merch_ayodhya');
      if (res.success && res.data) {
        setMerchant(res.data.merchant);
        setOrders(res.data.orders || []);
        setIsOpen(Boolean(res.data.merchant?.is_open));

        // Check for new incoming orders
        const pendingCount = (res.data.orders || []).filter(
          (o: any) => o.status === 'MERCHANT_CONFIRMATION_PENDING'
        ).length;

        if (pendingCount > prevPendingCountRef.current && prevPendingCountRef.current !== 0) {
          Alert.alert('🔔 New Order Alert!', `You have ${pendingCount} pending order(s) awaiting acceptance!`);
        }
        prevPendingCountRef.current = pendingCount;
      }

      // Fetch products if on STOCK tab
      const pRes = await apiClient.getProducts('merch_ayodhya');
      if (pRes.success && pRes.data) {
        setProducts(pRes.data);
      }
    } catch (e) {
      console.error('Error fetching dashboard', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(false);

    // Auto-poll orders every 4 seconds for live kitchen dispatch
    pollTimerRef.current = setInterval(() => {
      fetchDashboardData(false);
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchDashboardData]);

  const handleToggleOpen = async (val: boolean) => {
    setIsOpen(val);
    try {
      await apiClient.toggleMerchantOpen(val, merchant?.id || 'merch_ayodhya');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update store status');
      setIsOpen(!val);
    }
  };

  const handleToggleStock = async (product: Product, newInStock: boolean) => {
    setTogglingStockId(product.id);
    try {
      const res = await apiClient.toggleProductStock(product.id, newInStock);
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, in_stock: newInStock } : p))
        );
      } else {
        Alert.alert('Error', res.error?.message || 'Could not update stock');
      }
    } catch (e: any) {
      Alert.alert('Network Error', e?.message || 'Stock update failed');
    } finally {
      setTogglingStockId(null);
    }
  };

  const handleUpdateStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    prepTimeMinutes?: number,
    orderNumber?: string
  ) => {
    setProcessingId(orderId);
    try {
      const statusConfig = getOrderStatusConfig(nextStatus);
      const note = prepTimeMinutes
        ? `Accepted with estimated prep time of ${prepTimeMinutes} mins`
        : `Order marked as ${statusConfig.label}`;
      const res = await apiClient.updateOrderStatus(orderId, nextStatus, note);
      if (res.success) {
        if (nextStatus === 'MERCHANT_CONFIRMED') {
          setCelebrationModal({
            visible: true,
            orderNumber: orderNumber || orderId,
            prepTime: prepTimeMinutes || 15,
          });
        } else {
          Alert.alert('Status Updated', `Order marked as "${statusConfig.label}"`);
        }
        fetchDashboardData(false);
      } else {
        Alert.alert('Transition Error', res.error?.message || 'Cannot update order status');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptPrompt = (order: any) => {
    Alert.alert(
      'Accept Order',
      `Confirm order #${order.order_number} and select kitchen prep time:`,
      [
        { text: '15 mins', onPress: () => handleUpdateStatus(order.id, 'MERCHANT_CONFIRMED', 15, order.order_number) },
        { text: '25 mins', onPress: () => handleUpdateStatus(order.id, 'MERCHANT_CONFIRMED', 25, order.order_number) },
        { text: '40 mins', onPress: () => handleUpdateStatus(order.id, 'MERCHANT_CONFIRMED', 40, order.order_number) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRejectPrompt = (orderId: string) => {
    Alert.alert(
      'Reject Order',
      'Are you sure you want to reject this incoming order?',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Reject Order',
          style: 'destructive',
          onPress: () => handleUpdateStatus(orderId, 'MERCHANT_REJECTED'),
        },
      ]
    );
  };

  // Filter orders by tab
  const incomingOrders = orders.filter((o) => o.status === 'MERCHANT_CONFIRMATION_PENDING');
  const kitchenOrders = orders.filter((o) =>
    ['MERCHANT_CONFIRMED', 'PAYMENT_CONFIRMED', 'PREPARING'].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CUSTOMER_CANCELLED', 'MERCHANT_REJECTED'].includes(
      o.status
    )
  );

  const displayedOrders =
    activeTab === 'INCOMING'
      ? incomingOrders
      : activeTab === 'PREPARING'
      ? kitchenOrders
      : activeTab === 'COMPLETED'
      ? completedOrders
      : [];

  const todayGrossRevenue = orders
    .filter((o) => !['CUSTOMER_CANCELLED', 'MERCHANT_REJECTED'].includes(o.status))
    .reduce((sum, o) => sum + (o.grand_total || 0), 0);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Syncing store command center...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'left', 'right']}>
      <BrandHeader currentRole="merchant" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboardData(true)} />}
      >
      {/* Store Banner */}
      <View style={styles.merchantHeader}>
        <View style={styles.storeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeName}>{merchant?.business_name || 'Ayodhya Hotel'}</Text>
            <Text style={styles.storeCategory}>
              {merchant?.category || 'Food & Dining'} • {merchant?.town || 'Ilkal'}
            </Text>
            <Text style={styles.storePhone}>📞 {merchant?.phone || '9876543211'}</Text>
          </View>

          <View style={styles.toggleBox}>
            <Text style={[styles.toggleLabel, { color: isOpen ? Colors.success : Colors.danger }]}>
              {isOpen ? 'OPEN' : 'CLOSED'}
            </Text>
            <Switch
              value={isOpen}
              onValueChange={handleToggleOpen}
              trackColor={{ false: Colors.slate300, true: Colors.successLight }}
              thumbColor={isOpen ? Colors.success : Colors.slate400}
            />
          </View>
        </View>

        {/* Live Metrics */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{orders.length}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>₹{todayGrossRevenue}</Text>
            <Text style={styles.statLabel}>Gross Sales</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>★ {merchant?.rating || '4.8'}</Text>
            <Text style={styles.statLabel}>Store Rating</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'INCOMING' && styles.tabBtnActive]}
          onPress={() => setActiveTab('INCOMING')}
        >
          <Text style={[styles.tabText, activeTab === 'INCOMING' && styles.tabTextActive]}>
            🔔 New ({incomingOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PREPARING' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PREPARING')}
        >
          <Text style={[styles.tabText, activeTab === 'PREPARING' && styles.tabTextActive]}>
            🍳 Kitchen ({kitchenOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'COMPLETED' && styles.tabBtnActive]}
          onPress={() => setActiveTab('COMPLETED')}
        >
          <Text style={[styles.tabText, activeTab === 'COMPLETED' && styles.tabTextActive]}>
            📦 Past ({completedOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'STOCK' && styles.tabBtnActive]}
          onPress={() => setActiveTab('STOCK')}
        >
          <Text style={[styles.tabText, activeTab === 'STOCK' && styles.tabTextActive]}>
            📋 Stock ({products.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content: Stock Management */}
      {activeTab === 'STOCK' ? (
        <View style={styles.stockSection}>
          <Text style={styles.sectionHeading}>Live Stock Inventory</Text>
          <Text style={styles.sectionSub}>Toggle item availability instantly for customers in town</Text>

          <View style={styles.productList}>
            {products.map((item) => {
              const inStock = item.in_stock !== false && (item.in_stock as any) !== 0;
              const isToggling = togglingStockId === item.id;

              return (
                <View key={item.id} style={styles.stockCard}>
                  <View style={{ flex: 1, paddingRight: Spacing.md }}>
                    <View style={styles.vegRow}>
                      <Text style={styles.vegDot}>{item.is_veg ? '🟢 Veg' : '🔴 Non-Veg'}</Text>
                      <Text style={[styles.stockStatusBadge, inStock ? styles.badgeInStock : styles.badgeOos]}>
                        {inStock ? 'In Stock' : 'Out of Stock'}
                      </Text>
                    </View>
                    <Text style={styles.stockItemName}>{item.name}</Text>
                    <Text style={styles.stockItemPrice}>₹{item.price}</Text>
                  </View>

                  <View style={styles.stockSwitchCol}>
                    {isToggling ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Switch
                        value={inStock}
                        onValueChange={(val) => handleToggleStock(item, val)}
                        trackColor={{ false: Colors.dangerLight, true: Colors.successLight }}
                        thumbColor={inStock ? Colors.success : Colors.danger}
                      />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        /* Tab Content: Orders */
        <View>
          <Text style={styles.sectionHeading}>
            {activeTab === 'INCOMING'
              ? 'Pending Confirmation Orders'
              : activeTab === 'PREPARING'
              ? 'Active Orders Being Prepared'
              : 'Past & Dispatched Orders'}
          </Text>

          {displayedOrders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🍃</Text>
              <Text style={styles.emptyText}>No orders in this tab right now.</Text>
            </View>
          ) : (
            displayedOrders.map((order) => {
              const statusConfig = getOrderStatusConfig(order.status as OrderStatus);
              const isPending = order.status === 'MERCHANT_CONFIRMATION_PENDING';
              const isConfirmed = ['MERCHANT_CONFIRMED', 'PAYMENT_CONFIRMED', 'PREPARING'].includes(order.status);
              const isProcessing = processingId === order.id;

              return (
                <View key={order.id} style={styles.orderCard}>
                  {/* Order Card Header */}
                  <View style={styles.orderCardHeader}>
                    <View>
                      <Text style={styles.orderNumberText}>{order.order_number}</Text>
                      <Text style={styles.customerText}>📅 {order.created_at}</Text>
                    </View>
                    {order.status === 'MERCHANT_CONFIRMED' ? (
                      <View style={styles.celebrationStatusBadge}>
                        <Text style={styles.celebrationStatusText}>CONFIRMED ✓ 🎉</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                          {statusConfig.label}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.divider} />

                  {/* Items List */}
                  <View style={styles.itemsList}>
                    {(order.items || []).map((item: any, idx: number) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                        <Text style={styles.itemName}>{item.product_name}</Text>
                        <Text style={styles.itemPrice}>₹{item.total_price || item.unit_price * item.quantity}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.divider} />

                  {/* Order Details Footer */}
                  <View style={styles.orderFooterRow}>
                    <Text style={styles.totalText}>Grand Total: ₹{order.grand_total}</Text>
                    <Text style={styles.deliveryTypeText}>
                      {order.delivery_type === 'STORE_PICKUP'
                        ? '🏬 Self Pickup'
                        : order.delivery_type === 'MERCHANT_SELF'
                        ? '⚡ Store Delivery'
                        : '🛵 Platform Rider'}
                    </Text>
                  </View>

                  <Text style={styles.addressLine}>📍 {order.delivery_address}</Text>

                  {/* Actions according to State Machine */}
                  {isPending && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        disabled={isProcessing}
                        onPress={() => handleRejectPrompt(order.id)}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.acceptBtn]}
                        disabled={isProcessing}
                        onPress={() => handleAcceptPrompt(order)}
                      >
                        {isProcessing ? (
                          <ActivityIndicator color={Colors.white} size="small" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Accept Order ✓</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {isConfirmed && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.readyBtn]}
                        disabled={isProcessing}
                        onPress={() => handleUpdateStatus(order.id, 'READY_FOR_PICKUP')}
                      >
                        {isProcessing ? (
                          <ActivityIndicator color={Colors.white} size="small" />
                        ) : (
                          <Text style={styles.readyBtnText}>Mark Ready for Pickup 🚀</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
      </ScrollView>

      {/* Celebration Modal when Order is Marked as Merchant Confirmed */}
      {celebrationModal?.visible && (
        <Modal
          visible={celebrationModal.visible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCelebrationModal(null)}
        >
          <View style={styles.modalBackdrop}>
            <LinearGradient
              colors={['#044229', '#065f46', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.celebrationCard}
            >
              {/* Confetti / Sparkle Cluster */}
              <View style={styles.celebrationEmojiRow}>
                <Text style={styles.celebrationSparkle}>✨</Text>
                <View style={styles.celebrationIconCircle}>
                  <Text style={styles.celebrationBigEmoji}>🎉</Text>
                </View>
                <Text style={styles.celebrationSparkle}>✨</Text>
              </View>

              {/* Eyebrow & Badges */}
              <View style={styles.celebrationPill}>
                <Text style={styles.celebrationPillText}>★ ORDER CONFIRMED ★</Text>
              </View>

              {/* Main Headline */}
              <Text style={styles.celebrationTitle}>Kitchen Confirmed!</Text>
              <Text style={styles.celebrationSub}>
                Order #{celebrationModal.orderNumber} is marked as confirmed and kitchen prep has officially started!
              </Text>

              {/* Details Box with Gold Accent */}
              <View style={styles.celebrationDetailsBox}>
                <View style={styles.celebrationDetailRow}>
                  <Text style={styles.celebrationDetailLabel}>Kitchen Prep Time</Text>
                  <Text style={styles.celebrationDetailValue}>⏱️ {celebrationModal.prepTime} Mins</Text>
                </View>
                <View style={styles.celebrationDetailRow}>
                  <Text style={styles.celebrationDetailLabel}>Rider Dispatch</Text>
                  <Text style={[styles.celebrationDetailValue, { color: '#6ee7b7' }]}>🛵 Notified nearby</Text>
                </View>
              </View>

              <Text style={styles.celebrationFootnote}>
                Dishes will move to &quot;Ready for Pickup&quot; once prepared.
              </Text>

              {/* Action Button */}
              <TouchableOpacity
                style={styles.celebrationActionBtn}
                onPress={() => setCelebrationModal(null)}
                activeOpacity={0.85}
              >
                <Text style={styles.celebrationActionText}>Start Cooking & View Orders →</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>
      )}
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
    alignItems: 'flex-start',
  },
  storeName: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  storeCategory: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
    marginTop: 2,
  },
  storePhone: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  toggleBox: {
    alignItems: 'center',
  },
  toggleLabel: {
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
  statNumber: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
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
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
    marginTop: Spacing.sm,
  },
  sectionSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  emptyBox: {
    backgroundColor: Colors.white,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
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
    marginTop: Spacing.md,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumberText: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  customerText: {
    ...Typography.caption,
    color: Colors.textMuted,
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
    marginVertical: Spacing.sm,
  },
  itemsList: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQuantity: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
    width: 24,
  },
  itemName: {
    ...Typography.subhead,
    color: Colors.slate800,
    flex: 1,
  },
  itemPrice: {
    ...Typography.captionBold,
    color: Colors.slate800,
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
    ...Typography.captionBold,
    color: Colors.slate600,
  },
  addressLine: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  rejectBtnText: {
    ...Typography.subheadBold,
    color: Colors.danger,
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    ...Typography.subheadBold,
    color: Colors.white,
  },
  readyBtn: {
    backgroundColor: Colors.secondaryDark,
  },
  readyBtnText: {
    ...Typography.subheadBold,
    color: Colors.white,
  },
  stockSection: {
    marginTop: Spacing.sm,
  },
  productList: {
    gap: Spacing.md,
  },
  stockCard: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vegDot: {
    fontSize: 11,
    fontWeight: '600',
  },
  stockStatusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  badgeInStock: {
    backgroundColor: Colors.successLight,
    color: Colors.success,
  },
  badgeOos: {
    backgroundColor: Colors.dangerLight,
    color: Colors.danger,
  },
  stockItemName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  stockItemPrice: {
    ...Typography.captionBold,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stockSwitchCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationStatusBadge: {
    backgroundColor: '#eaf8f2',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  celebrationStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#08774c',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 30, 56, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  celebrationEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  celebrationIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  celebrationBigEmoji: {
    fontSize: 34,
  },
  celebrationSparkle: {
    fontSize: 22,
  },
  celebrationPill: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  celebrationPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 1.2,
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 4,
  },
  celebrationSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  celebrationDetailsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  celebrationDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  celebrationDetailLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  celebrationDetailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  celebrationFootnote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    marginBottom: 18,
  },
  celebrationActionBtn: {
    width: '100%',
    backgroundColor: '#ff8a16',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  celebrationActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
