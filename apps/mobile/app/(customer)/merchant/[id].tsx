import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../../src/api';
import { useCart } from '../../../src/context/CartContext';
import { Product } from '@ownlocal/types';

export default function MerchantCatalogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [merchant, setMerchant] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietFilter, setDietFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  const {
    items: cartItems,
    merchantId: cartMerchantId,
    merchantName: cartMerchantName,
    itemCount,
    grandTotal,
    addItem,
    updateQuantity,
    clearCart,
  } = useCart();

  useEffect(() => {
    if (!id) return;
    Promise.all([apiClient.getMerchant(id), apiClient.getProducts(id)])
      .then(([mRes, pRes]) => {
        if (mRes.success) setMerchant(mRes.data);
        if (pRes.success) setProducts(pRes.data || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Compute quantity in cart for a given product
  const getProductQuantity = (productId: string): number => {
    const found = cartItems.find((ci) => ci.product.id === productId);
    return found ? found.quantity : 0;
  };

  const handleAddToCart = (product: Product) => {
    if (!merchant) return;

    const success = addItem(product, {
      id: merchant.id,
      name: merchant.business_name,
    });

    if (!success) {
      Alert.alert(
        'Replace cart items?',
        `Your cart already contains items from "${cartMerchantName}". Would you like to discard them and start a new order from "${merchant.business_name}"?`,
        [
          { text: 'Keep Current Cart', style: 'cancel' },
          {
            text: 'Clear & Add',
            style: 'destructive',
            onPress: () => {
              clearCart();
              addItem(product, {
                id: merchant.id,
                name: merchant.business_name,
              });
            },
          },
        ]
      );
    }
  };

  // Filtered menu items
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const isVeg = Boolean(p.is_veg);
      const matchesDiet =
        dietFilter === 'ALL' ||
        (dietFilter === 'VEG' && isVeg) ||
        (dietFilter === 'NON_VEG' && !isVeg);

      return matchesSearch && matchesDiet;
    });
  }, [products, searchQuery, dietFilter]);

  const vegCount = useMemo(() => products.filter((p) => Boolean(p.is_veg)).length, [products]);
  const nonVegCount = useMemo(() => products.filter((p) => !Boolean(p.is_veg)).length, [products]);

  const getItemEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('dosa')) return '🥞';
    if (n.includes('puri') || n.includes('poori')) return '🥣';
    if (n.includes('idli') || n.includes('vada') || n.includes('thali') || n.includes('rice') || n.includes('biryani')) return '🍛';
    if (n.includes('coffee') || n.includes('tea') || n.includes('chai')) return '☕';
    if (n.includes('cold') || n.includes('drink') || n.includes('juice') || n.includes('water') || n.includes('beverage')) return '🥤';
    if (n.includes('saree') || n.includes('handloom') || n.includes('silk') || n.includes('cloth')) return '🧵';
    if (n.includes('oil') || n.includes('dal') || n.includes('atta') || n.includes('sugar') || n.includes('rice')) return '🌾';
    if (n.includes('apple') || n.includes('banana') || n.includes('fruit') || n.includes('mango')) return '🍎';
    if (n.includes('vegetable') || n.includes('tomato') || n.includes('onion') || n.includes('potato')) return '🥕';
    if (n.includes('tablet') || n.includes('medicine') || n.includes('capsule') || n.includes('syrup')) return '💊';
    return '🍽️';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#073f7c" />
        <Text style={styles.loadingText}>Loading store catalog...</Text>
      </View>
    );
  }

  const isCartFromThisStore = cartMerchantId === id;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, cartItems.length > 0 && { paddingBottom: 110 }]}>
        {/* Back Link & Store Title Header (POC Style) */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹ Stores</Text>
        </TouchableOpacity>

        <View style={styles.storeHeader}>
          <Text style={styles.eyebrow}>
            {merchant?.business_name ? `${merchant.business_name} • Ilkal` : 'LOCAL MERCHANT DEMO'}
          </Text>
          <Text style={styles.storeTitle}>Good food, made nearby.</Text>
          <Text style={styles.storeSubtitle}>
            {merchant?.category || 'Breakfast & Dining'} • {merchant?.address || 'Ilkal Main Road'} • Own delivery + partner delivery
          </Text>

          {/* Badges Row */}
          <View style={styles.badgeRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {merchant?.rating || '4.8'}</Text>
            </View>
            <View style={styles.deliveryBadge}>
              <Text style={styles.deliveryBadgeText}>
                {merchant?.own_delivery_enabled ? '⚡ Direct Store Delivery' : '🛵 Platform Rider Assured'}
              </Text>
            </View>
            <View style={styles.radiusBadge}>
              <Text style={styles.radiusBadgeText}>
                Radius: {merchant?.service_radius_km || 5} km
              </Text>
            </View>
          </View>
        </View>

        {/* Conflict Notice if cart belongs to another store */}
        {cartItems.length > 0 && !isCartFromThisStore && (
          <View style={styles.otherStoreCartNotice}>
            <Text style={styles.otherStoreText}>
              🛒 Cart has {itemCount} items from <Text style={{ fontWeight: '700' }}>{cartMerchantName}</Text>
            </Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/cart')}>
              <Text style={styles.viewCartLink}>View Cart →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Menu Search Bar */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search dishes in ${merchant?.business_name || 'store'}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9db0c4"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Diet Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, dietFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setDietFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, dietFilter === 'ALL' && styles.filterTextActive]}>
              All ({products.length})
            </Text>
          </TouchableOpacity>

          {vegCount > 0 && (
            <TouchableOpacity
              style={[styles.filterChip, dietFilter === 'VEG' && styles.filterChipActive]}
              onPress={() => setDietFilter('VEG')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, dietFilter === 'VEG' && styles.filterTextActive]}>
                🟢 Veg ({vegCount})
              </Text>
            </TouchableOpacity>
          )}

          {nonVegCount > 0 && (
            <TouchableOpacity
              style={[styles.filterChip, dietFilter === 'NON_VEG' && styles.filterChipActive]}
              onPress={() => setDietFilter('NON_VEG')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, dietFilter === 'NON_VEG' && styles.filterTextActive]}>
                🔴 Non-Veg ({nonVegCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Section Heading */}
        <Text style={styles.sectionHeading}>
          Menu Catalog ({filteredProducts.length})
        </Text>

        {/* Product Items List matching POC structure */}
        <View style={styles.productList}>
          {filteredProducts.map((item) => {
            const qty = isCartFromThisStore ? getProductQuantity(item.id) : 0;
            const isOutOfStock = item.in_stock === false || (item.in_stock as any) === 0;

            return (
              <View key={item.id} style={[styles.itemCard, isOutOfStock && styles.itemCardOos]}>
                {/* 44px Icon Container with warm background */}
                <View style={styles.itemIconBox}>
                  <Text style={styles.itemEmoji}>{getItemEmoji(item.name)}</Text>
                </View>

                {/* Item Text Info */}
                <View style={styles.itemTextCol}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.is_veg ? (
                      <Text style={styles.vegTag}>🟢</Text>
                    ) : (
                      <Text style={styles.vegTag}>🔴</Text>
                    )}
                  </View>

                  {item.description ? (
                    <Text style={styles.itemDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                </View>

                {/* Quantity Stepper / Add Button matching POC */}
                <View style={styles.qtyContainer}>
                  {isOutOfStock ? (
                    <View style={styles.disabledBtn}>
                      <Text style={styles.disabledBtnText}>Unavailable</Text>
                    </View>
                  ) : qty === 0 ? (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleAddToCart(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.stepperBox}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, -1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperQtyText}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => updateQuantity(item.id, 1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {filteredProducts.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyText}>No items found matching your filters</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Cart Bar in Vibrant Brand Orange / Navy */}
      {cartItems.length > 0 && (
        <View style={styles.floatingCartBar}>
          <View>
            <Text style={styles.cartCountText}>
              🛒 {itemCount} {itemCount === 1 ? 'item' : 'items'}
              {cartMerchantName ? ` • ${cartMerchantName}` : ''}
            </Text>
            <Text style={styles.cartTotalText}>
              ₹{grandTotal}{' '}
              <Text style={styles.taxNote}>(incl. delivery)</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => router.push('/(customer)/cart')}
            activeOpacity={0.85}
          >
            <Text style={styles.checkoutBtnText}>View cart • ₹{grandTotal} →</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f8fc',
  },
  loadingText: {
    fontSize: 13,
    color: '#6f7f91',
    marginTop: 12,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: '#f5f8fc',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 0,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#073f7c',
  },
  storeHeader: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dce6ef',
  },
  eyebrow: {
    fontSize: 10,
    color: '#078ee8',
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  storeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#142b46',
    marginTop: 4,
  },
  storeSubtitle: {
    fontSize: 11,
    color: '#6f7f91',
    marginTop: 4,
    lineHeight: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  ratingBadge: {
    backgroundColor: '#fff0da',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#a55a00',
    fontWeight: '800',
  },
  deliveryBadge: {
    backgroundColor: '#eaf8f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveryBadgeText: {
    fontSize: 11,
    color: '#08774c',
    fontWeight: '700',
  },
  radiusBadge: {
    backgroundColor: '#f2f6fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  radiusBadgeText: {
    fontSize: 11,
    color: '#6f7f91',
    fontWeight: '600',
  },
  otherStoreCartNotice: {
    backgroundColor: '#fff0da',
    borderColor: '#ff8a16',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otherStoreText: {
    fontSize: 11,
    color: '#142b46',
    flex: 1,
  },
  viewCartLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#073f7c',
    marginLeft: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafcff',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#dce6ef',
    paddingHorizontal: 12,
    marginTop: 14,
    height: 44,
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
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce6ef',
  },
  filterChipActive: {
    backgroundColor: '#073f7c',
    borderColor: '#073f7c',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6f7f91',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#142b46',
    marginTop: 16,
    marginBottom: 10,
  },
  productList: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#dce6ef',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemCardOos: {
    opacity: 0.55,
  },
  itemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fff2df',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#142b46',
  },
  vegTag: {
    fontSize: 10,
  },
  itemDesc: {
    fontSize: 11,
    color: '#6f7f91',
    marginTop: 2,
    lineHeight: 15,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#142b46',
    marginTop: 4,
  },
  qtyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: '#edf5fb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce6ef',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#073f7c',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce6ef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    color: '#073f7c',
    fontSize: 16,
    fontWeight: '900',
  },
  stepperQtyText: {
    color: '#142b46',
    fontWeight: '800',
    fontSize: 13,
    minWidth: 16,
    textAlign: 'center',
  },
  disabledBtn: {
    backgroundColor: '#f2f6fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  disabledBtnText: {
    fontSize: 11,
    color: '#6f7f91',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyEmoji: {
    fontSize: 38,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6f7f91',
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
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cartCountText: {
    fontSize: 11,
    color: '#c8d6e5',
  },
  cartTotalText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  taxNote: {
    fontSize: 10,
    color: '#9db0c4',
    fontWeight: '400',
  },
  checkoutBtn: {
    backgroundColor: '#ff8a16',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
  },
  checkoutBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
