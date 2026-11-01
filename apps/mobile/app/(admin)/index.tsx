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
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api';
import { MerchantProfile, RiderProfile, OrderStatus } from '@ownlocal/types';
import { BrandHeader } from '../../src/components/BrandHeader';

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

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAdminData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [mRes, merchRes, riderRes, orderRes] = await Promise.all([
        apiClient.getAdminMetrics(),
        apiClient.getAdminMerchants(),
        apiClient.getAdminRiders(),
        apiClient.getAdminOrders(),
      ]);

      if (mRes.success && mRes.data) setMetrics(mRes.data);
      if (merchRes.success && merchRes.data) setMerchants(merchRes.data);
      if (riderRes.success && riderRes.data) setRiders(riderRes.data);
      if (orderRes.success && orderRes.data) setOrders(orderRes.data);
    } catch (e) {
      console.error('Failed to fetch admin data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting to Ilkal Control Tower...</Text>
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
        <Text style={styles.townTag}>📍 {metrics.town?.toUpperCase()} PILOT LAUNCH</Text>
        <Text style={styles.title}>Town Operations Control Tower</Text>
        <Text style={styles.subtitle}>Super Admin Live Governance • Cloudflare D1 Backend</Text>
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
          <Text style={styles.kpiChange}>Ilkal Commercial</Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'METRICS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('METRICS')}
        >
          <Text style={[styles.tabText, activeTab === 'METRICS' && styles.tabTextActive]}>
            📊 System
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

      {/* Tab: System & Infrastructure */}
      {activeTab === 'METRICS' && (
        <View style={styles.sectionCol}>
          <View style={styles.auditCard}>
            <Text style={styles.auditTitle}>Cloudflare Infrastructure Status</Text>
            <Text style={styles.auditText}>• D1 Database: `ownlocal-live-db` (SQLite 3 / APAC Region)</Text>
            <Text style={styles.auditText}>• R2 Asset Bucket: `ownlocal-live-assets` (Zero Egress Fees)</Text>
            <Text style={styles.auditText}>• Worker Gateway: `ownlocal-live-api` (Global Edge Sub-50ms)</Text>
            <Text style={styles.auditText}>• Security: Native WebCrypto HS256 JWT + Server-Side RBAC</Text>
          </View>

          <View style={styles.governanceCard}>
            <Text style={styles.govTitle}>Town Pilot Guidelines (Ilkal)</Text>
            <Text style={styles.govText}>
              All order state transitions strictly enforce single-store exclusivity, delivery OTP verification, and tamper-proof financial logging.
            </Text>
          </View>
        </View>
      )}

      {/* Tab: Merchant Approvals & Management */}
      {activeTab === 'MERCHANTS' && (
        <View style={styles.sectionCol}>
          <Text style={styles.sectionHeading}>Merchant Compliance & Directory</Text>

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
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tab: Riders Directory & Duty Status */}
      {activeTab === 'RIDERS' && (
        <View style={styles.sectionCol}>
          <Text style={styles.sectionHeading}>Rider Fleet Directory</Text>

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
                    <Text style={styles.merchantAuditName}>{o.merchant_name || 'Ilkal Store'}</Text>
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
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  suspendBtnText: {
    ...Typography.captionBold,
    color: Colors.danger,
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
});
