import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '@ownlocal/ui';
import { UserRole } from '@ownlocal/types';

interface BrandHeaderProps {
  currentRole?: UserRole;
  showRoles?: boolean;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function BrandHeader({ currentRole = 'customer', showRoles = true, subtitle, rightAction }: BrandHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const roles: Array<{ id: UserRole; label: string; route: string }> = [
    { id: 'customer', label: 'Customer', route: '/(customer)' },
    { id: 'merchant', label: 'Merchant', route: '/(merchant)' },
    { id: 'rider', label: 'Rider', route: '/(rider)' },
    { id: 'admin', label: 'Admin', route: '/(admin)' },
  ];

  const handleRolePress = (route: string) => {
    router.replace(route as any);
  };

  return (
    <View style={styles.container}>
      {/* 5px Brand Topline Gradient Line: Cyan (55%) & Vibrant Orange (45%) */}
      <View style={styles.topline}>
        <View style={styles.toplineCyan} />
        <View style={styles.toplineOrange} />
      </View>

      <View style={styles.headerBody}>
        {/* Brand Row: Logo + Pilot Badge + Optional Actions */}
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {rightAction}
            <View style={styles.pill}>
              <Text style={styles.pillText}>LIVE</Text>
            </View>
          </View>
        </View>

        {subtitle && (
          <Text style={styles.subtitleText}>{subtitle}</Text>
        )}

        {/* 4-Role Navigation Bar (From original POC) */}
        {showRoles && (
          <View style={styles.roleBar}>
            {roles.map((r) => {
              const isActive = currentRole === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roleBtn, isActive && styles.roleBtnActive]}
                  onPress={() => handleRolePress(r.route)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleBtnText, isActive && styles.roleBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dce6ef',
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
  headerBody: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 160,
    height: 44,
  },
  pill: {
    backgroundColor: '#eef5fc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dce6ef',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#073f7c',
    letterSpacing: 0.8,
  },
  subtitleText: {
    fontSize: 11,
    color: '#6f7f91',
    marginTop: 4,
  },
  roleBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  roleBtn: {
    flex: 1,
    backgroundColor: '#f2f6fa',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleBtnActive: {
    backgroundColor: '#073f7c',
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#637488',
  },
  roleBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
