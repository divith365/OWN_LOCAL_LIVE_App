import React, { useEffect, useState, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { apiClient } from '../../src/api';
import { useCart } from '../../src/context/CartContext';
import { BrandHeader } from '../../src/components/BrandHeader';

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'Food & Dining', name: 'Food', icon: '🍲' },
  { id: 'Kirana & Daily Needs', name: 'Grocery', icon: '🛒' },
  { id: 'Fresh Fruits & Veggies', name: 'Produce', icon: '🥕' },
  { id: 'Ilkal Sarees & Handloom', name: 'Ilkal Sarees', icon: '🧵' },
  { id: 'Pharmacy & Healthcare', name: 'Pharmacy', icon: '💊' },
];

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const { itemCount, grandTotal } = useCart();
  const scrollRef = useRef<ScrollView>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [merchants, setMerchants] = useState<any[]>([]);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // GPS state
  const [locationName, setLocationName] = useState('Detecting current GPS...');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Request & Read Native GPS
  const handleDetectGps = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('Location Access Needed (Tap to Detect)');
        setLocating(false);
        setCoords({ lat: 15.9587, lng: 76.1264 });
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

      // Reverse geocode customer's real town & neighborhood
      const [address] = await Location.reverseGeocodeAsync({
        latitude: newCoords.lat,
        longitude: newCoords.lng,
      });
      if (address) {
        const area = address.name || address.street || address.subregion || address.district || 'Current Location';
        const city = address.city || address.subregion || address.district || '';
        const pin = address.postalCode ? ` • ${address.postalCode}` : '';
        setLocationName(`${area}${city && city !== area ? `, ${city}` : ''}${pin}`);
      } else {
        setLocationName(`Lat: ${newCoords.lat.toFixed(3)}, Lng: ${newCoords.lng.toFixed(3)}`);
      }
    } catch {
      // Fallback
      setLocationName('Gandhi Chowk, Ilkal • 587125 (Pilot)');
      setCoords({ lat: 15.9587, lng: 76.1264 });
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    handleDetectGps();
  }, []);

  const fetchCatalog = async () => {
    try {
      const categoryParam = selectedCategory === 'all' ? undefined : selectedCategory;
      const res = await apiClient.getMerchants({
        category: categoryParam,
        q: searchQuery || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        strict_radius: true,
      });

      if (res.success && res.data) {
        setMerchants(res.data);
      } else {
        setMerchants([]);
      }

      // If searching, also search products
      if (searchQuery.trim().length >= 2) {
        const pRes = await apiClient.searchProducts(searchQuery.trim(), {
          lat: coords?.lat,
          lng: coords?.lng,
        });
        if (pRes.success) {
          setProductResults(pRes.data || []);
        }
      } else {
        setProductResults([]);
      }
    } catch (e) {
      console.error(e);
      setMerchants([]);
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

  const handleHeroAction = () => {
    // If Ayodhya Hotel exists, navigate to it directly as the POC showcase
    const ayodhya = merchants.find((m) => m.business_name?.toLowerCase().includes('ayodhya'));
    if (ayodhya) {
      router.push(`/(customer)/merchant/${ayodhya.id}` as any);
    } else if (merchants.length > 0) {
      router.push(`/(customer)/merchant/${merchants[0].id}` as any);
    } else {
      scrollRef.current?.scrollTo({ y: 350, animated: true });
    }
  };

  const getStoreEmoji = (category: string) => {
    if (category.includes('Food')) return '🍲';
    if (category.includes('Saree')) return '🧵';
    if (category.includes('Kirana')) return '🛍️';
    if (category.includes('Pharmacy')) return '💊';
    if (category.includes('Produce') || category.includes('Fruit')) return '🥬';
    return '🏬';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Authentic POC Brand Header with Dual Gradient Topline & 4-Role Navigation */}
      <BrandHeader
        currentRole="customer"
        rightAction={
          <View style={styles.headerActionRow}>
            <TouchableOpacity
              onPress={() => router.push('/(customer)/orders' as any)}
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBtnText}>📦</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(customer)/cart')}
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBtnText}>🛒</Text>
              {itemCount > 0 && (
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, itemCount > 0 && { paddingBottom: 110 }]}
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
        {/* Delivering To Bar */}
        <View style={styles.locationBar}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>DELIVERING TO</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {locationName}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.detectGpsBtn}
            disabled={locating}
            onPress={handleDetectGps}
            activeOpacity={0.8}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#073f7c" />
            ) : (
              <Text style={styles.detectGpsText}>⚡ Detect GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section Eyebrow & Headline from Original POC */}
        <View style={styles.introHeader}>
          <Text style={styles.eyebrow}>DISCOVER AROUND YOU</Text>
          <Text style={styles.headline}>Shop local. Live better.</Text>
        </View>

        {/* Search Bar matching POC style */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search food, groceries or stores..."
            placeholderTextColor="#9db0c4"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Hero Card */}
        <LinearGradient
          colors={['#063f7d', '#079ce9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroEyebrow}>HYPERLOCAL DIRECT DELIVERY</Text>
          <Text style={styles.heroTitle}>Everything nearby,{"\n"}one simple app.</Text>
          <Text style={styles.heroDesc}>
            Verified neighbourhood shops delivering within their local radius. Pay only when arrangements are confirmed.
          </Text>
          <TouchableOpacity
            style={styles.heroBtn}
            activeOpacity={0.85}
            onPress={handleHeroAction}
          >
            <Text style={styles.heroBtnText}>Try sample order →</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Explore Categories - Authentic 4-Grid from POC */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Explore categories</Text>
          <TouchableOpacity
            onPress={() => setSelectedCategory('all')}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLink}>
              {selectedCategory === 'all' ? 'All active' : 'View all'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                onPress={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Product Search Matches (if any) */}
        {productResults.length > 0 && (
          <View style={styles.productMatchSection}>
            <Text style={styles.sectionTitle}>Matching Items in Radius ({productResults.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {productResults.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.productMatchCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(customer)/merchant/${p.merchant_id}` as any)}
                >
                  <Text style={styles.matchStoreName} numberOfLines={1}>🏪 {p.business_name} ({p.distanceKm} km)</Text>
                  <Text style={styles.matchProdName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.matchPrice}>₹{p.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Stores Near You Heading */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>
            {searchQuery ? `Stores matching "${searchQuery}"` : 'Stores Delivering Near You'}
          </Text>
          <Text style={styles.sectionBadge}>
            {merchants.length} {merchants.length === 1 ? 'store' : 'stores'}
          </Text>
        </View>

        {/* Store Cards Feed */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#073f7c" />
            <Text style={styles.loadingText}>Checking verified delivery radiuses near you...</Text>
          </View>
        ) : merchants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>No stores deliver to this location</Text>
            <Text style={styles.emptySubtitle}>
              Stores on OwnLocal only deliver within their verified service radius. None currently deliver to:{"\n"}
              <Text style={{ fontWeight: '700', color: '#142b46' }}>{locationName}</Text>
            </Text>

            <TouchableOpacity
              style={styles.pilotSwitchBtn}
              onPress={() => {
                setCoords({ lat: 15.9587, lng: 76.1264 });
                setLocationName('Gandhi Chowk, Ilkal • 587125 (Pilot)');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.pilotSwitchBtnText}>🛍️ Test With Ilkal Pilot Stores</Text>
            </TouchableOpacity>
          </View>
        ) : (
          merchants.map((merchant) => (
            <TouchableOpacity
              key={merchant.id}
              style={styles.storeCard}
              activeOpacity={0.82}
              onPress={() => router.push(`/(customer)/merchant/${merchant.id}` as any)}
            >
              {/* Warm POC Store Icon (54x54, #fff2df, 12px border radius) */}
              <View style={styles.storeIconBox}>
                <Text style={styles.storeIconText}>{getStoreEmoji(merchant.category)}</Text>
              </View>

              {/* Store Details */}
              <View style={styles.storeBody}>
                <View style={styles.storeTitleRow}>
                  <Text style={styles.storeName}>{merchant.business_name}</Text>
                  <Text style={styles.ratingText}>★ {merchant.rating || '4.8'}</Text>
                </View>
                <Text style={styles.storeDesc} numberOfLines={1}>
                  {merchant.category} • {merchant.address || merchant.town || 'Local Town'}
                </Text>
                <View style={styles.tagRow}>
                  <View style={[styles.tagPill, merchant.can_self_deliver && styles.tagPillSelf]}>
                    <Text style={[styles.tagText, merchant.can_self_deliver && styles.tagTextSelf]}>
                      {!merchant.is_open
                        ? 'Store Closed'
                        : merchant.can_self_deliver
                        ? '⚡ Store Delivery'
                        : '🛵 Rider Delivery'}
                    </Text>
                  </View>
                  {merchant.distanceKm !== null && (
                    <Text style={styles.distanceText}>
                      • {merchant.distanceKm} km (Radius: {merchant.service_radius_km} km)
                    </Text>
                  )}
                </View>
              </View>

              {/* POC Chevron */}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Floating Bottom Cart Bar matching POC */}
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
            activeOpacity={0.85}
          >
            <Text style={styles.viewCartText}>View Cart & Checkout →</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f8fc',
  },
  contentContainer: {
    padding: 16,
    paddingTop: 12,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f2f6fa',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerBtnText: {
    fontSize: 16,
  },
  badgeCount: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ff8a16',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  locationBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce6ef',
    marginBottom: 14,
  },
  locationInfo: {
    flex: 1,
    paddingRight: 8,
  },
  locationLabel: {
    fontSize: 10,
    color: '#6f7f91',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142b46',
    marginTop: 2,
  },
  detectGpsBtn: {
    backgroundColor: '#eef5fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#073f7c',
  },
  detectGpsText: {
    fontSize: 11,
    color: '#073f7c',
    fontWeight: '700',
  },
  introHeader: {
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 11,
    color: '#078ee8',
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#142b46',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafcff',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dce6ef',
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 18,
    color: '#6f7f91',
    marginRight: 8,
    fontWeight: '600',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#142b46',
  },
  clearSearch: {
    fontSize: 14,
    color: '#6f7f91',
    paddingHorizontal: 4,
  },
  heroCard: {
    padding: 19,
    borderRadius: 17,
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.8,
    opacity: 0.85,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 28,
    marginTop: 6,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 13,
    color: '#ffffff',
    opacity: 0.9,
    lineHeight: 18,
    marginBottom: 16,
  },
  heroBtn: {
    backgroundColor: '#ff8a16',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 9,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#142b46',
  },
  sectionLink: {
    fontSize: 11,
    color: '#078ee8',
    fontWeight: '700',
  },
  sectionBadge: {
    fontSize: 11,
    color: '#078ee8',
    fontWeight: '700',
  },
  categoriesGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#f7faff',
    borderWidth: 1,
    borderColor: '#e8eff6',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  categoryCardSelected: {
    backgroundColor: '#073f7c',
    borderColor: '#073f7c',
  },
  categoryIcon: {
    fontSize: 23,
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#142b46',
  },
  categoryNameSelected: {
    color: '#ffffff',
  },
  productMatchSection: {
    marginBottom: 16,
  },
  productMatchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: '#078ee8',
    width: 170,
  },
  matchStoreName: {
    fontSize: 11,
    color: '#073f7c',
    fontWeight: '600',
  },
  matchProdName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#142b46',
    marginTop: 3,
  },
  matchPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#142b46',
    marginTop: 2,
  },
  storeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce6ef',
    padding: 13,
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeIconBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#fff2df',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeIconText: {
    fontSize: 28,
  },
  storeBody: {
    flex: 1,
  },
  storeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#142b46',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a55a00',
    backgroundColor: '#fff0da',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  storeDesc: {
    fontSize: 11,
    color: '#6f7f91',
    lineHeight: 16,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  tagPill: {
    backgroundColor: '#eaf8f2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: {
    color: '#08774c',
    fontSize: 9,
    fontWeight: '800',
  },
  distanceText: {
    fontSize: 10,
    color: '#6f7f91',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    fontWeight: '700',
    color: '#078ee8',
    paddingHorizontal: 4,
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#6f7f91',
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce6ef',
    marginVertical: 12,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#142b46',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6f7f91',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  pilotSwitchBtn: {
    backgroundColor: '#073f7c',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  pilotSwitchBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tagPillSelf: {
    backgroundColor: '#fff0da',
  },
  tagTextSelf: {
    color: '#c25e00',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#142b46',
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBarCount: {
    fontSize: 11,
    color: '#c8d6e5',
    fontWeight: '600',
  },
  cartBarTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  viewCartBtn: {
    backgroundColor: '#ff8a16',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
  },
  viewCartText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
