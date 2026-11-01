import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { useAuth } from '../src/context/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, role: activeRole, logout } = useAuth();

  const menuItems = [
    {
      id: 'customer',
      label: 'Customer',
      kannadaLabel: 'ಗ್ರಾಹಕರು',
      icon: '🛍️',
      route: '/(customer)',
      accentColor: Colors.primary,
      tintBg: Colors.primaryTint,
    },
    {
      id: 'merchant',
      label: 'Merchant',
      kannadaLabel: 'ವ್ಯಾಪಾರಿಗಳು',
      icon: '🏪',
      route: '/(merchant)',
      accentColor: Colors.secondaryDark,
      tintBg: Colors.secondaryTint,
    },
    {
      id: 'rider',
      label: 'Rider',
      kannadaLabel: 'ಡೆಲಿವರಿ ಪಾಲುದಾರ',
      icon: '🛵',
      route: '/(rider)',
      accentColor: '#0284C7',
      tintBg: '#e0f2fe',
    },
    {
      id: 'admin',
      label: 'Admin',
      kannadaLabel: 'ನಿರ್ವಾಹಕರು',
      icon: '🛡️',
      route: '/(admin)',
      accentColor: '#475569',
      tintBg: '#f1f5f9',
    },
  ];

  const portalCards = [
    {
      id: 'customer',
      title: 'Customer Marketplace',
      kannadaSub: 'ನಿಮ್ಮ ಊರಿನ ಅಂಗಡಿಗಳು, ಹೋಟೆಲ್ & ಕಿರಾಣಿ',
      desc: 'Browse Ayodhya Hotel, Ilkal Sarees, Kirana & live order with real-time GPS tracking',
      route: '/(customer)',
      icon: '🛍️',
      badge: 'Shop Live',
      actionText: 'Enter Marketplace →',
      color: Colors.primary,
      bgTint: Colors.primaryTint,
    },
    {
      id: 'merchant',
      title: 'Merchant Dashboard',
      kannadaSub: 'ಆರ್ಡರ್ ನಿರ್ವಹಣೆ & ಲೈವ್ ಇನ್ವೆಂಟರಿ',
      desc: 'Incoming order tickets, instant accept, menu/product catalog & store sales',
      route: '/(merchant)',
      icon: '🏪',
      badge: 'Store Hub',
      actionText: 'Open Store Panel →',
      color: Colors.secondaryDark,
      bgTint: Colors.secondaryTint,
    },
    {
      id: 'rider',
      title: 'Delivery Partner Console',
      kannadaSub: 'ಲೈವ್ ಡೆಲಿವರಿ & ನಕ್ಷೆ ಟ್ರ್ಯಾಕಿಂಗ್',
      desc: 'GPS duty toggle, live delivery route navigation, order pickup & partner earnings',
      route: '/(rider)',
      icon: '🛵',
      badge: 'Partner App',
      actionText: 'Start Delivering →',
      color: '#0284C7',
      bgTint: '#e0f2fe',
    },
    {
      id: 'admin',
      title: 'Admin Operations',
      kannadaSub: 'ಪಟ್ಟಣದ ವ್ಯಾಪಾರಿಗಳು & ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ನಿಯಂತ್ರಣ',
      desc: 'Onboard new merchants with GPS auto-pick, manage catalog & platform oversight',
      route: '/(admin)',
      icon: '🛡️',
      badge: 'Management',
      actionText: 'Launch Console →',
      color: '#475569',
      bgTint: '#f1f5f9',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* 4px Dual-Gradient Topline matching POC */}
      <View style={styles.topline}>
        <View style={styles.toplineCyan} />
        <View style={styles.toplineOrange} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header with Official Logo & Location */}
        <View style={styles.header}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.locationPill}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText}>Ilkal, Karnataka • Hyperlocal Marketplace</Text>
          </View>
        </View>

        {/* 4 Persona Options as Sleek Top Menu Bar */}
        <View style={styles.menuBarContainer}>
          <Text style={styles.menuBarLabel}>PORTAL MENU / ತ್ವರಿತ ಪ್ರವೇಶ</Text>
          <View style={styles.menuItemsRow}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItemBtn}
                activeOpacity={0.75}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.menuItemIconBox, { backgroundColor: item.tintBg }]}>
                  <Text style={styles.menuItemIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.menuItemTitle}>{item.label}</Text>
                <Text style={styles.menuItemKannada}>{item.kannadaLabel}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Fancy Hero Section with Authentic Kannada Taglines */}
        <View style={styles.heroCard}>
          {/* Slogan Pill */}
          <View style={styles.sloganPill}>
            <Text style={styles.sloganText}>✨ Search • Shop • Delivered ✨</Text>
          </View>

          {/* Brand Heading */}
          <Text style={styles.heroBrand}>Own Local Live</Text>

          {/* Primary Kannada Tagline */}
          <Text style={styles.heroKannadaPrimary}>
            "ನಿಮ್ಮ ಮನೆ ಬಾಗಿಲಿಗೆ, ನಿಮಗೆ ಬೇಕಾಗಿದ್ದೆಲ್ಲವೂ!"
          </Text>

          {/* Secondary Kannada Highlight Banner */}
          <View style={styles.heroSecondaryBanner}>
            <Text style={styles.heroSecondaryIcon}>🌟</Text>
            <Text style={styles.heroKannadaSecondary}>
              "ನಿಮ್ಮ ಊರು, ನಿಮ್ಮ ಅಂಗಡಿ, ನಿಮ್ಮ ಖರೀದಿ!"
            </Text>
          </View>

          {/* Value Highlights */}
          <View style={styles.heroFeaturesRow}>
            <View style={styles.heroFeaturePill}>
              <Text style={styles.heroFeatureText}>⚡ 15–30 Min Delivery</Text>
            </View>
            <View style={styles.heroFeaturePill}>
              <Text style={styles.heroFeatureText}>🏪 100% Local Shops</Text>
            </View>
            <View style={styles.heroFeaturePill}>
              <Text style={styles.heroFeatureText}>📍 Live GPS Tracking</Text>
            </View>
          </View>
        </View>

        {/* Live Auth Banner */}
        <View style={styles.authBanner}>
          {isAuthenticated ? (
            <View style={styles.authRow}>
              <View>
                <Text style={styles.authTitle}>
                  👤 Logged In: <Text style={{ fontWeight: '700' }}>+91-{user?.phone}</Text>
                </Text>
                <Text style={styles.authSub}>Active Role: {activeRole?.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                <Text style={styles.logoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.loginCardBtn}
              activeOpacity={0.8}
              onPress={() => router.push('/login')}
            >
              <View style={styles.loginIconBox}>
                <Text style={{ fontSize: 20 }}>🔐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.loginCardTitle}>Sign In / Register Store</Text>
                <Text style={styles.loginCardSub}>
                  Login via Phone OTP or register your local store on OwnLocal
                </Text>
              </View>
              <Text style={styles.loginArrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Persona Portals Detailed Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Marketplace Portals</Text>
          <Text style={styles.sectionSubHeading}>ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ</Text>
        </View>

        <View style={styles.cardsGrid}>
          {portalCards.map((portal) => (
            <TouchableOpacity
              key={portal.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(portal.route as any)}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: portal.bgTint }]}>
                  <Text style={styles.iconText}>{portal.icon}</Text>
                </View>
                <View style={[styles.badgeContainer, { backgroundColor: portal.bgTint }]}>
                  <Text style={[styles.badgeText, { color: portal.color }]}>{portal.badge}</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{portal.title}</Text>
              <Text style={styles.cardKannadaSub}>{portal.kannadaSub}</Text>
              <Text style={styles.cardDesc}>{portal.desc}</Text>

              <View style={styles.cardFooter}>
                <Text style={[styles.launchText, { color: portal.color }]}>{portal.actionText}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Own Local Live • Connecting Town Neighborhoods • Ilkal, Karnataka
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logo: {
    width: 210,
    height: 52,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    gap: 4,
  },
  locationPin: {
    fontSize: 12,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate700,
  },

  /* 4 Persona Options as Horizontal Menu Bar */
  menuBarContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate500,
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  menuItemsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuItemBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.slate50,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItemIconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  menuItemIcon: {
    fontSize: 20,
  },
  menuItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate900,
  },
  menuItemKannada: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.slate600,
    marginTop: 2,
  },

  /* Fancy Hero Section */
  heroCard: {
    backgroundColor: '#073f7c',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#0a4f9a',
    shadowColor: '#073f7c',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sloganPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 148, 24, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#ff9418',
    marginBottom: 10,
  },
  sloganText: {
    color: '#ffb356',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroBrand: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  heroKannadaPrimary: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 28,
    marginTop: 6,
    marginBottom: 12,
  },
  heroSecondaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginBottom: 14,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9418',
  },
  heroSecondaryIcon: {
    fontSize: 16,
  },
  heroKannadaSecondary: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fef08a',
    flex: 1,
    lineHeight: 22,
  },
  heroFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  heroFeaturePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  heroFeatureText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Auth Banner */
  authBanner: {
    marginBottom: Spacing.lg,
  },
  authRow: {
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  authTitle: {
    ...Typography.subhead,
    color: Colors.slate900,
  },
  authSub: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutBtnText: {
    ...Typography.caption,
    color: Colors.danger,
    fontWeight: '700',
  },
  loginCardBtn: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  loginIconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCardTitle: {
    ...Typography.subheadBold,
    color: Colors.slate900,
  },
  loginCardSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  loginArrow: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '700',
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.slate900,
  },
  sectionSubHeading: {
    fontSize: 12,
    color: Colors.slate500,
    fontWeight: '500',
  },

  /* Portal Cards */
  cardsGrid: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
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
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.slate900,
  },
  cardKannadaSub: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondaryDark,
    marginTop: 2,
    marginBottom: 4,
    lineHeight: 18,
  },
  cardDesc: {
    ...Typography.subhead,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  launchText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Footer Note */
  footerNote: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  footerText: {
    fontSize: 11,
    color: Colors.slate500,
    textAlign: 'center',
  },
});
