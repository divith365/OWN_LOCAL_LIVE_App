import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography } from '@ownlocal/ui';
import { apiClient } from '../../../src/api';

export default function MerchantCatalogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [merchant, setMerchant] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([apiClient.getMerchant(id), apiClient.getProducts(id)])
      .then(([mRes, pRes]) => {
        if (mRes.success) setMerchant(mRes.data);
        if (pRes.success) setProducts(pRes.data || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const cartItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const cartTotal = products.reduce((acc, p) => {
    const qty = cart[p.id] || 0;
    return acc + p.price * qty;
  }, 0);

  const handlePlaceOrder = async () => {
    if (cartItemsCount === 0) return;
    setOrdering(true);

    const items = Object.entries(cart).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));

    try {
      const res = await apiClient.createOrder({
        merchant_id: id as string,
        items,
        delivery_type: merchant?.own_delivery_enabled ? 'MERCHANT_SELF' : 'PLATFORM_RIDER',
        delivery_address: 'Gandhi Chowk, Near Basaveshwar Temple, Ilkal - 587125',
        payment_method: 'UPI',
      });

      if (res.success && res.data) {
        setCreatedOrder(res.data);
        setCart({});
      } else {
        Alert.alert('Error', res.error?.message || 'Could not place order');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to connect');
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading store catalog...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Store Header Card */}
        <View style={styles.storeHeader}>
          <Text style={styles.storeName}>{merchant?.business_name || 'Store Details'}</Text>
          <Text style={styles.storeCategory}>{merchant?.category}</Text>
          <Text style={styles.storeAddress}>📍 {merchant?.address}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>★ {merchant?.rating || '4.8'}</Text>
            </View>
            <View style={styles.deliveryBadge}>
              <Text style={styles.deliveryBadgeText}>
                {merchant?.own_delivery_enabled ? 'Direct Store Delivery' : 'Platform Rider Assured'}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Confirmed Banner */}
        {createdOrder && (
          <View style={styles.orderSuccessBanner}>
            <Text style={styles.orderSuccessTitle}>🎉 Order Placed Successfully!</Text>
            <Text style={styles.orderSuccessText}>
              Order Number: <Text style={{ fontWeight: '700' }}>{createdOrder.order_number}</Text>
            </Text>
            <Text style={styles.orderSuccessText}>
              Status: <Text style={{ fontWeight: '700', color: Colors.warning }}>{createdOrder.status}</Text>
            </Text>
            <Text style={styles.orderSuccessText}>
              Delivery OTP: <Text style={{ fontWeight: '700' }}>{createdOrder.delivery_otp}</Text>
            </Text>
            <Text style={styles.orderSuccessSubtext}>
              Awaiting merchant acceptance at {merchant?.business_name}.
            </Text>
          </View>
        )}

        {/* Menu Section */}
        <Text style={styles.sectionHeading}>Menu & Catalog</Text>

        <View style={styles.productList}>
          {products.map((item) => {
            const qty = cart[item.id] || 0;
            return (
              <View key={item.id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <View style={styles.vegIndicatorRow}>
                    <Text style={styles.vegDot}>{item.is_veg ? '🟢 Veg' : '🔴 Non-Veg'}</Text>
                  </View>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>₹{item.price}</Text>
                  {item.description && (
                    <Text style={styles.productDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>

                {/* Add / Quantity Buttons */}
                <View style={styles.qtyContainer}>
                  {qty === 0 ? (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => updateQuantity(item.id, 1)}
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
        </View>
      </ScrollView>

      {/* Floating Bottom Cart Bar */}
      {cartItemsCount > 0 && (
        <View style={styles.bottomCartBar}>
          <View>
            <Text style={styles.cartCountText}>{cartItemsCount} {cartItemsCount === 1 ? 'item' : 'items'}</Text>
            <Text style={styles.cartTotalText}>₹{cartTotal + 30} <Text style={styles.taxNote}>(incl. ₹30 delivery & platform)</Text></Text>
          </View>

          <TouchableOpacity
            style={styles.placeOrderBtn}
            disabled={ordering}
            onPress={handlePlaceOrder}
          >
            {ordering ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.placeOrderText}>Place Order →</Text>
            )}
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
    paddingBottom: 100,
  },
  storeHeader: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeName: {
    ...Typography.title2,
    color: Colors.slate900,
  },
  storeCategory: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
    marginTop: 4,
  },
  storeAddress: {
    ...Typography.subhead,
    color: Colors.textMuted,
    marginTop: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  orderSuccessBanner: {
    backgroundColor: Colors.successLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  orderSuccessTitle: {
    ...Typography.bodyBold,
    color: Colors.success,
  },
  orderSuccessText: {
    ...Typography.subhead,
    color: Colors.slate800,
    marginTop: 4,
  },
  orderSuccessSubtext: {
    ...Typography.caption,
    color: Colors.slate600,
    marginTop: 6,
    fontStyle: 'italic',
  },
  sectionHeading: {
    ...Typography.title3,
    color: Colors.slate900,
    marginTop: Spacing.xl,
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
  productInfo: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  vegIndicatorRow: {
    marginBottom: 2,
  },
  vegDot: {
    fontSize: 11,
    fontWeight: '600',
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
