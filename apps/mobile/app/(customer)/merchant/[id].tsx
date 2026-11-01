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
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading store catalog...</Text>
      </View>
    );
  }

  const isCartFromThisStore = cartMerchantId === id;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Store Header Card */}
        <View style={styles.storeHeader}>
          <View style={styles.storeHeaderTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName}>{merchant?.business_name || 'Store Details'}</Text>
              <Text style={styles.storeCategory}>{merchant?.category?.toUpperCase()}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {merchant?.rating || '4.8'}</Text>
            </View>
          </View>

          <Text style={styles.storeAddress}>📍 {merchant?.address}</Text>

          <View style={styles.badgeRow}>
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
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search dishes in ${merchant?.business_name || 'store'}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Diet Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, dietFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setDietFilter('ALL')}
          >
            <Text style={[styles.filterText, dietFilter === 'ALL' && styles.filterTextActive]}>
              All ({products.length})
            </Text>
          </TouchableOpacity>

          {vegCount > 0 && (
            <TouchableOpacity
              style={[styles.filterChip, dietFilter === 'VEG' && styles.filterChipActive]}
              onPress={() => setDietFilter('VEG')}
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

        {/* Product List */}
        <View style={styles.productList}>
          {filteredProducts.map((item) => {
            const qty = isCartFromThisStore ? getProductQuantity(item.id) : 0;
            const isOutOfStock = item.in_stock === false || (item.in_stock as any) === 0;

            return (
              <View key={item.id} style={[styles.productCard, isOutOfStock && styles.productCardOos]}>
                <View style={styles.productInfo}>
                  <View style={styles.vegIndicatorRow}>
                    <Text style={styles.vegDot}>{item.is_veg ? '🟢 Pure Veg' : '🔴 Non-Veg'}</Text>
                    {isOutOfStock && <Text style={styles.oosTag}>Out of stock</Text>}
                  </View>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>₹{item.price}</Text>
                  {item.description ? (
                    <Text style={styles.productDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                {/* Add / Stepper Counter */}
                <View style={styles.qtyContainer}>
                  {isOutOfStock ? (
                    <View style={styles.disabledBtn}>
                      <Text style={styles.disabledBtnText}>Unavailable</Text>
                    </View>
                  ) : qty === 0 ? (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleAddToCart(item)}
                    >
                      <Text style={styles.addBtnText}>ADD +</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.counterBox}>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => updateQuantity(item.id, -1)}
                      >
                        <Text style={styles.counterBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterText}>{qty}</Text>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => updateQuantity(item.id, 1)}
                      >
                        <Text style={styles.counterBtnText}>+</Text>
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

      {/* Floating Bottom Cart Bar */}
      {cartItems.length > 0 && (
        <View style={styles.bottomCartBar}>
          <View>
            <Text style={styles.cartCountText}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
              {cartMerchantName ? ` • ${cartMerchantName}` : ''}
            </Text>
            <Text style={styles.cartTotalText}>
              ₹{grandTotal}{' '}
              <Text style={styles.taxNote}>(incl. ₹30 delivery & platform)</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.placeOrderBtn}
            onPress={() => router.push('/(customer)/cart')}
          >
            <Text style={styles.placeOrderText}>View Cart →</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 12,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 110,
  },
  storeHeader: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeaderTop: {
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
    letterSpacing: 0.5,
  },
  storeAddress: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.md,
  },
  ratingBadge: {
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  ratingText: {
    ...Typography.caption,
    color: Colors.slate900,
    fontWeight: '700',
  },
  deliveryBadge: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  deliveryBadgeText: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  radiusBadge: {
    backgroundColor: Colors.slate100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  radiusBadgeText: {
    ...Typography.caption,
    color: Colors.slate600,
  },
  otherStoreCartNotice: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otherStoreText: {
    ...Typography.caption,
    color: Colors.slate800,
    flex: 1,
  },
  viewCartLink: {
    ...Typography.captionBold,
    color: Colors.primaryDark,
    marginLeft: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
  },
  clearSearch: {
    fontSize: 16,
    color: Colors.textMuted,
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    ...Typography.captionBold,
    color: Colors.slate700,
  },
  filterTextActive: {
    color: Colors.white,
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  productList: {
    gap: Spacing.md,
  },
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productCardOos: {
    opacity: 0.6,
  },
  productInfo: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  vegIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vegDot: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slate700,
  },
  oosTag: {
    fontSize: 10,
    color: Colors.danger,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  productPrice: {
    ...Typography.bodyBold,
    color: Colors.slate800,
    marginTop: 2,
  },
  productDesc: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  qtyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addBtnText: {
    ...Typography.subheadBold,
    color: Colors.primaryDark,
  },
  counterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  counterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  counterBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  counterText: {
    color: Colors.white,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  disabledBtn: {
    backgroundColor: Colors.slate200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  disabledBtnText: {
    ...Typography.caption,
    color: Colors.slate500,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    ...Typography.subhead,
    color: Colors.textMuted,
  },
  bottomCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.slate900,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -3 },
  },
  cartCountText: {
    ...Typography.caption,
    color: Colors.slate400,
  },
  cartTotalText: {
    ...Typography.title3,
    color: Colors.white,
  },
  taxNote: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '400',
  },
  placeOrderBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  placeOrderText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
});
