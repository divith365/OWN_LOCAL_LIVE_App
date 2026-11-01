import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { apiClient } from '../../src/api';
import { useCart } from '../../src/context/CartContext';

const CATEGORIES = [
  { id: 'all', name: 'All Stores' },
  { id: 'Food & Dining', name: 'Food & Dining' },
  { id: 'Ilkal Sarees & Handloom', name: 'Ilkal Sarees' },
  { id: 'Kirana & Daily Needs', name: 'Kirana Store' },
  { id: 'Pharmacy & Healthcare', name: 'Pharmacy' },
  { id: 'Fresh Fruits & Veggies', name: 'Fresh Fruits' },
];

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const { itemCount, grandTotal } = useCart();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [merchants, setMerchants] = useState<any[]>([]);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // GPS state
  const [locationName, setLocationName] = useState('Gandhi Chowk, Ilkal • 587125');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 15.9587,
    lng: 76.1264,
  });
  const [locating, setLocating] = useState(false);

  // Request & Read Native GPS
  const handleDetectGps = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Using default Ilkal pilot center (Gandhi Chowk).');
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setCoords(newCoords);

      // Reverse geocode town
      const [address] = await Location.reverseGeocodeAsync({
        latitude: newCoords.lat,
        longitude: newCoords.lng,
      });
      if (address) {
        setLocationName(`${address.name || address.street || 'Current Location'}, ${address.city || 'Ilkal'} • ${address.postalCode || '587125'}`);
      }
    } catch {
      // Fallback
      setLocationName('Gandhi Chowk, Ilkal • 587125');
    } finally {
      setLocating(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const categoryParam = selectedCategory === 'all' ? undefined : selectedCategory;
      const res = await apiClient.getMerchants({
        category: categoryParam,
        q: searchQuery || undefined,
        lat: coords.lat,
        lng: coords.lng,
      });

      if (res.success && res.data) {
        setMerchants(res.data);
      }

      // If searching, also search products
      if (searchQuery.trim().length >= 2) {
        const pRes = await apiClient.searchProducts(searchQuery.trim(), {
          lat: coords.lat,
          lng: coords.lng,
        });
        if (pRes.success) {
          setProductResults(pRes.data || []);
        }
      } else {
        setProductResults([]);
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
    fetchCatalog();
  }, [selectedCategory, coords]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCatalog();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      {/* Location Bar with Native GPS detection */}
      <View style={styles.locationBar}>
        <View style={styles.locationInfo}>
          <Text style={styles.locationLabel}>DELIVERING TO</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            📍 {locationName}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.changeLocBtn}
          disabled={locating}
          onPress={handleDetectGps}
        >
          {locating ? (
            <ActivityIndicator size="small" color={Colors.primaryDark} />
          ) : (
            <Text style={styles.changeLocText}>⚡ Detect GPS</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search stores, masala dosa, sarees, kirana..."
            placeholderTextColor={Colors.slate400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Carousel */}
      <View>
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
      </View>

      {/* Feed Content */}
      <ScrollView
        contentContainerStyle={[styles.feedContent, itemCount > 0 && { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchCatalog();
            }}
          />
        }
      >
        {/* Product Search Matches (if any) */}
        {productResults.length > 0 && (
          <View style={styles.productMatchSection}>
            <Text style={styles.sectionTitle}>Matching Items in Ilkal ({productResults.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {productResults.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.productMatchCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(customer)/merchant/${p.merchant_id}` as any)}
                >
                  <Text style={styles.matchStoreName}>🏪 {p.business_name} ({p.distanceKm} km)</Text>
                  <Text style={styles.matchProdName}>{p.name}</Text>
                  <Text style={styles.matchPrice}>₹{p.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.feedHeading}>
          {searchQuery ? `Stores matching "${searchQuery}"` : 'Nearby Stores in Ilkal'}
        </Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Calculating nearby stores via Haversine...</Text>
          </View>
        ) : merchants.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyTitle}>No stores found</Text>
            <Text style={styles.emptySubtitle}>Try searching for a different keyword or category</Text>
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

      {/* Floating Bottom Cart Bar */}
      {itemCount > 0 && (
        <View style={styles.floatingCartBar}>
          <View>
            <Text style={styles.cartBarCount}>
              🛒 {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.cartBarTotal}>Total: ₹{grandTotal}</Text>
          </View>

          <TouchableOpacity
            style={styles.viewCartBtn}
            onPress={() => router.push('/(customer)/cart' as any)}
          >
            <Text style={styles.viewCartText}>View Cart & Checkout →</Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingRight: Spacing.sm,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  changeLocText: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.slate900,
  },
  clearSearch: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingHorizontal: 4,
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
  productMatchSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.subheadBold,
    color: Colors.slate800,
    marginBottom: 8,
  },
  productMatchCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    width: 170,
  },
  matchStoreName: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  matchProdName: {
    ...Typography.subheadBold,
    color: Colors.slate900,
    marginTop: 4,
  },
  matchPrice: {
    ...Typography.subheadBold,
    color: Colors.slate800,
    marginTop: 2,
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
  floatingCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.slate900,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBarCount: {
    ...Typography.caption,
    color: Colors.slate300,
    fontWeight: '600',
  },
  cartBarTotal: {
    ...Typography.title3,
    color: Colors.white,
    marginTop: 2,
  },
  viewCartBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  viewCartText: {
    ...Typography.subheadBold,
    color: Colors.white,
  },
});
