import React, { useEffect, useState } from 'react';
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
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { apiClient } from '../../src/api';

const CATEGORIES = [
  { id: 'all', name: 'All Stores' },
  { id: 'Food & Dining', name: 'Food & Dining' },
  { id: 'Ilkal Sarees & Handloom', name: 'Ilkal Sarees' },
  { id: 'Kirana & Daily Needs', name: 'Kirana Store' },
  { id: 'Pharmacy & Healthcare', name: 'Pharmacy' },
];

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMerchants = async () => {
    try {
      const categoryParam = selectedCategory === 'all' ? undefined : selectedCategory;
      const res = await apiClient.getMerchants({ category: categoryParam });
      if (res.success && res.data) {
        setMerchants(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchMerchants();
  }, [selectedCategory]);

  return (
    <View style={styles.container}>
      {/* Location Bar */}
      <View style={styles.locationBar}>
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>DELIVERING TO</Text>
          <Text style={styles.locationText}>📍 Gandhi Chowk, Ilkal • 587125</Text>
        </View>
        <TouchableOpacity style={styles.changeLocBtn}>
          <Text style={styles.changeLocText}>GPS Active</Text>
        </TouchableOpacity>
      </View>

      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                isSelected && styles.categoryChipSelected,
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isSelected && styles.categoryChipTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Merchants Feed */}
      <ScrollView
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMerchants(); }} />
        }
      >
        <Text style={styles.feedHeading}>Nearby Stores in Ilkal</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Finding nearby stores with D1 Haversine...</Text>
          </View>
        ) : merchants.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptySubtitle}>Try selecting a different category</Text>
          </View>
        ) : (
          merchants.map((merchant) => (
            <TouchableOpacity
              key={merchant.id}
              style={styles.merchantCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/(customer)/merchant/${merchant.id}` as any)}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.storeIconBox}>
                  <Text style={styles.storeIconText}>
                    {merchant.category.includes('Food')
                      ? '🍲'
                      : merchant.category.includes('Saree')
                      ? '🥻'
                      : merchant.category.includes('Kirana')
                      ? '🛒'
                      : merchant.category.includes('Pharmacy')
                      ? '💊'
                      : '🏬'}
                  </Text>
                </View>

                <View style={styles.storeInfo}>
                  <Text style={styles.businessName}>{merchant.business_name}</Text>
                  <Text style={styles.categoryName}>{merchant.category}</Text>
                  <Text style={styles.addressText} numberOfLines={1}>
                    {merchant.address}
                  </Text>
                </View>

                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>★ {merchant.rating || '4.8'}</Text>
                </View>
              </View>

              <View style={styles.cardMetaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>📍 {merchant.distanceKm} km away</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    {merchant.own_delivery_enabled ? '🛵 Store Delivery' : '⚡ Platform Rider'}
                  </Text>
                </View>
                <View style={[styles.metaPill, { backgroundColor: Colors.successLight }]}>
                  <Text style={[styles.metaPillText, { color: Colors.success }]}>
                    {merchant.is_open ? 'Open Now' : 'Closed'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
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
  locationBar: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  locationText: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    marginTop: 2,
  },
  changeLocBtn: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  changeLocText: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  categoryScroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    ...Typography.subhead,
    color: Colors.slate700,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },
  feedContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
  },
  feedHeading: {
    ...Typography.title3,
    color: Colors.slate900,
    marginBottom: Spacing.xs,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 12,
  },
  emptyTitle: {
    ...Typography.title3,
    color: Colors.slate700,
  },
  emptySubtitle: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 4,
  },
  merchantCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.slate100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  storeIconText: {
    fontSize: 24,
  },
  storeInfo: {
    flex: 1,
  },
  businessName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    fontSize: 16,
  },
  categoryName: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  addressText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ratingBadge: {
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  ratingText: {
    ...Typography.caption,
    color: Colors.slate900,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    gap: 8,
  },
  metaPill: {
    backgroundColor: Colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  metaPillText: {
    ...Typography.caption,
    color: Colors.slate700,
  },
});
