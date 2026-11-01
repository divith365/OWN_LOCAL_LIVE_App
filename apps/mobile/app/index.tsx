import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { apiClient } from '../src/api';

export default function RoleSwitcherScreen() {
  const router = useRouter();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [serverInfo, setServerInfo] = useState<any>(null);

  useEffect(() => {
    apiClient
      .getHealth()
      .then((res) => {
        if (res.success && res.data) {
          setHealthStatus('connected');
          setServerInfo(res.data);
        } else {
          setHealthStatus('error');
        }
      })
      .catch(() => setHealthStatus('error'));
  }, []);

  const roles = [
    {
      id: 'customer',
      title: 'Customer Marketplace',
      desc: 'Browse Ayodhya Hotel, Ilkal Sarees, Kirana & order with live tracking',
      route: '/(customer)',
      icon: '🛍️',
      badge: 'Pilot Active',
      color: Colors.primary,
    },
    {
      id: 'merchant',
      title: 'Merchant Dashboard',
      desc: 'Manage orders, incoming tickets, product catalog & live inventory',
      route: '/(merchant)',
      icon: '🏪',
      badge: 'Ayodhya Hotel',
      color: Colors.secondaryDark,
    },
    {
      id: 'rider',
      title: 'Delivery Partner Console',
      desc: 'Online/offline switch, live GPS ping, pickup and delivery verification',
      route: '/(rider)',
      icon: '🛵',
      badge: 'KA-29 Pilot',
      color: '#0284C7',
    },
    {
      id: 'admin',
      title: 'Admin Operations',
      desc: 'Town oversight, KYC approvals, payment reconciliation & audit',
      route: '/(admin)',
      icon: '🛡️',
      badge: 'Full Access',
      color: '#475569',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandLogo}>⚡</Text>
            <Text style={styles.brandTitle}>OWNLOCAL LIVE</Text>
          </View>
          <Text style={styles.tagline}>Hyperlocal Marketplace Platform • Ilkal Pilot</Text>

          {/* Cloudflare Backend Status Indicator */}
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    healthStatus === 'connected'
                      ? Colors.success
                      : healthStatus === 'error'
                      ? Colors.danger
                      : Colors.warning,
                },
              ]}
            />
            {healthStatus === 'checking' && (
              <ActivityIndicator size="small" color={Colors.textMuted} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.statusText}>
              {healthStatus === 'connected'
                ? `Cloudflare D1 API Live (${serverInfo?.pilot_town || 'Ilkal'})`
                : healthStatus === 'error'
                ? 'Backend Offline'
                : 'Connecting to Cloudflare...'}
            </Text>
          </View>
        </View>

        {/* Roles Section */}
        <Text style={styles.sectionHeading}>Select Persona to Launch</Text>

        <View style={styles.cardsGrid}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(role.route as any)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: role.color + '18' }]}>
                  <Text style={styles.iconText}>{role.icon}</Text>
                </View>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{role.badge}</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{role.title}</Text>
              <Text style={styles.cardDesc}>{role.desc}</Text>

              <View style={styles.cardFooter}>
                <Text style={[styles.launchText, { color: role.color }]}>Enter Mode →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Architecture Specs Banner */}
        <View style={styles.techBanner}>
          <Text style={styles.techTitle}>Production Architecture Foundation</Text>
          <Text style={styles.techText}>
            • React Native + Expo Router (Android & iOS){'\n'}
            • Cloudflare Workers + D1 SQLite Database{'\n'}
            • Cloudflare R2 Bucket for Assets & Documents{'\n'}
            • Strict Order State Machine & Haversine Discovery
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    fontSize: 32,
  },
  brandTitle: {
    ...Typography.title1,
    color: Colors.slate900,
    letterSpacing: 0.5,
  },
  tagline: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    ...Typography.caption,
    color: Colors.slate700,
    fontWeight: '600',
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate800,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  cardsGrid: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 22,
  },
  badgeContainer: {
    backgroundColor: Colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.slate600,
    fontWeight: '600',
  },
  cardTitle: {
    ...Typography.title3,
    color: Colors.slate900,
    marginTop: Spacing.xs,
  },
  cardDesc: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  launchText: {
    ...Typography.bodyBold,
    fontSize: 14,
  },
  techBanner: {
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  techTitle: {
    ...Typography.subheadBold,
    color: Colors.slate800,
    marginBottom: 4,
  },
  techText: {
    ...Typography.caption,
    color: Colors.slate600,
    lineHeight: 18,
  },
});
