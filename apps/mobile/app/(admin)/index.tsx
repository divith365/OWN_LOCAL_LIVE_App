import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';

export default function AdminDashboardScreen() {
  const stats = [
    { label: 'Active Merchants', value: '5', change: 'Ilkal Launch Pilot' },
    { label: 'Registered Riders', value: '3', change: '2 On-Duty' },
    { label: 'Total Orders', value: '48', change: '₹14,920 GMV' },
    { label: 'Platform Revenue', value: '₹1,240', change: 'Take rate 8.3%' },
  ];

  const merchantsQueue = [
    { name: 'Ayodhya Hotel', category: 'Food & Dining', status: 'Approved', docs: 'FSSAI Verified' },
    { name: 'Ilkal Heritage Sarees', category: 'Handloom', status: 'Approved', docs: 'GST Verified' },
    { name: 'Basaveshwar Kirana', category: 'Kirana', status: 'Approved', docs: 'Trade License Verified' },
    { name: 'Shri Guru Bakery', category: 'Bakery & Sweets', status: 'Pending Review', docs: 'Docs Submitted' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.title}>Ilkal Pilot Control Tower</Text>
        <Text style={styles.subtitle}>Super Admin Operations • Cloudflare D1 Backend</Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        {stats.map((s, idx) => (
          <View key={idx} style={styles.kpiCard}>
            <Text style={styles.kpiVal}>{s.value}</Text>
            <Text style={styles.kpiLabel}>{s.label}</Text>
            <Text style={styles.kpiChange}>{s.change}</Text>
          </View>
        ))}
      </View>

      {/* Verification Queue */}
      <Text style={styles.sectionHeading}>Merchant Approvals & Compliance</Text>

      <View style={styles.queueContainer}>
        {merchantsQueue.map((item, idx) => {
          const isPending = item.status === 'Pending Review';
          return (
            <View key={idx} style={styles.queueRow}>
              <View style={styles.queueInfo}>
                <Text style={styles.queueName}>{item.name}</Text>
                <Text style={styles.queueSub}>{item.category} • {item.docs}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isPending ? Colors.warningLight : Colors.successLight },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isPending ? Colors.warning : Colors.success },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* System Health */}
      <View style={styles.auditCard}>
        <Text style={styles.auditTitle}>Cloudflare Infrastructure Status</Text>
        <Text style={styles.auditText}>• D1 Database: `ownlocal-live-db` (APAC Region, Active)</Text>
        <Text style={styles.auditText}>• R2 Bucket: `ownlocal-live-assets` (Standard Tier)</Text>
        <Text style={styles.auditText}>• Worker: `ownlocal-live-api` (100% Health Score)</Text>
      </View>
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
  headerCard: {
    backgroundColor: Colors.slate900,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  title: {
    ...Typography.title2,
    color: Colors.white,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.slate400,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  kpiCard: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '47%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiVal: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  kpiLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  kpiChange: {
    fontSize: 10,
    color: Colors.primaryDark,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
  },
  queueContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  queueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  queueInfo: {
    flex: 1,
  },
  queueName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  queueSub: {
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
  auditCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  auditTitle: {
    ...Typography.subheadBold,
    color: Colors.slate800,
    marginBottom: 6,
  },
  auditText: {
    ...Typography.caption,
    color: Colors.slate700,
    lineHeight: 18,
  },
});
