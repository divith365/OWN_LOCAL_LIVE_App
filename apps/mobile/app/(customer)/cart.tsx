import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Typography, getOrderStatusConfig } from '@ownlocal/ui';
import { useCart } from '../../src/context/CartContext';
import { apiClient } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';

const ILKAL_PRESET_ADDRESSES = [
  'Gandhi Chowk, Near Basaveshwar Temple, Ilkal - 587125',
  'Main Bazaar Road, Near Vijaya Mahantesh Math, Ilkal - 587125',
  'Station Road, Opposite KSRTC Bus Stand, Ilkal - 587125',
];

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    items,
    merchantId,
    merchantName,
    itemCount,
    itemTotal,
    platformFee,
    clearCart,
    updateQuantity,
  } = useCart();

  const [deliveryType, setDeliveryType] = useState<'PLATFORM_RIDER' | 'MERCHANT_SELF' | 'STORE_PICKUP'>('PLATFORM_RIDER');
  const [address, setAddress] = useState(ILKAL_PRESET_ADDRESSES[0]);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'COD' | 'CARD'>('UPI');
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // Dynamic delivery fee calculation
  const deliveryFee = deliveryType === 'STORE_PICKUP' ? 0 : 25;
  const grandTotal = itemTotal + deliveryFee + platformFee;

  const handlePlaceOrder = async () => {
    if (!merchantId || items.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to your cart before placing an order.');
      return;
    }

    if (!address.trim() && deliveryType !== 'STORE_PICKUP') {
      Alert.alert('Address Required', 'Please enter a valid delivery address in Ilkal.');
      return;
    }

    setLoading(true);

    try {
      const orderPayload = {
        merchant_id: merchantId,
        items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          notes: orderNotes.trim() || undefined,
        })),
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'STORE_PICKUP' ? `Pickup at ${merchantName || 'Store'}` : address.trim(),
        payment_method: paymentMethod,
      };

      const res = await apiClient.createOrder(orderPayload as any);

      if (res.success && res.data) {
        setPlacedOrder(res.data);
        clearCart();
      } else {
        Alert.alert('Order Failed', res.error?.message || 'Could not place order. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Network Error', err?.message || 'Unable to connect to Ilkal marketplace server.');
    } finally {
      setLoading(false);
    }
  };

  // If order was successfully placed, display the live confirmation screen
  if (placedOrder) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>Order Confirmed!</Text>
            <Text style={styles.successSub}>
              Sent to <Text style={{ fontWeight: '700' }}>{merchantName || 'Merchant'}</Text>
            </Text>

            <View style={styles.orderMetadataBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Order Number:</Text>
                <Text style={styles.metaValue}>{placedOrder.order_number}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Order Status:</Text>
                <Text style={[styles.metaValue, { color: getOrderStatusConfig(placedOrder.status).text, fontWeight: '700' }]}>
                  {getOrderStatusConfig(placedOrder.status).label}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Delivery OTP:</Text>
                <Text style={[styles.metaValue, { color: Colors.primaryDark, fontSize: 18, fontWeight: '800' }]}>
                  {placedOrder.delivery_otp}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Total Paid/Payable:</Text>
                <Text style={styles.metaValue}>₹{placedOrder.grand_total}</Text>
              </View>
            </View>

            <View style={styles.otpNotice}>
              <Text style={styles.otpNoticeText}>
                🔒 Share the Delivery OTP with your rider only upon physical receipt of your parcel.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.trackOrderBtn}
              onPress={() => router.replace(`/(customer)/orders/${placedOrder.id}` as any)}
            >
              <Text style={styles.trackOrderBtnText}>Track Order Live →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.replace('/(customer)')}
            >
              <Text style={styles.doneBtnText}>Back to Marketplace</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Empty cart view
  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyIcon}>🛍️</Text>
        <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Explore authentic stores and restaurants in Ilkal to add delicious food or local products!
        </Text>
        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={() => router.replace('/(customer)')}
        >
          <Text style={styles.exploreBtnText}>Browse Stores →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Active Store Bar */}
        <View style={styles.storeBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.storeBarLabel}>ORDERING FROM</Text>
            <Text style={styles.storeBarName}>{merchantName}</Text>
          </View>
          <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear Cart</Text>
          </TouchableOpacity>
        </View>

        {/* Cart Items List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Items ({itemCount})</Text>
          {items.map(({ product, quantity }) => (
            <View key={product.id} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.vegTag}>{product.is_veg ? '🟢' : '🔴'}</Text>
                <View>
                  <Text style={styles.itemName}>{product.name}</Text>
                  <Text style={styles.itemUnitPrice}>₹{product.price} each</Text>
                </View>
              </View>

              <View style={styles.itemRight}>
                <View style={styles.qtyBox}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(product.id, -1)}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyNum}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(product.id, 1)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemSubtotal}>₹{product.price * quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Options */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Delivery Type</Text>
          <View style={styles.optionsCol}>
            <TouchableOpacity
              style={[styles.radioOption, deliveryType === 'PLATFORM_RIDER' && styles.radioOptionActive]}
              onPress={() => setDeliveryType('PLATFORM_RIDER')}
            >
              <Text style={styles.optionIcon}>🛵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Platform Rider Assured</Text>
                <Text style={styles.optionSub}>Verified local Ilkal delivery rider</Text>
              </View>
              <Text style={styles.optionPrice}>₹25</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.radioOption, deliveryType === 'MERCHANT_SELF' && styles.radioOptionActive]}
              onPress={() => setDeliveryType('MERCHANT_SELF')}
            >
              <Text style={styles.optionIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Direct Store Delivery</Text>
                <Text style={styles.optionSub}>Delivered directly by store staff</Text>
              </View>
              <Text style={styles.optionPrice}>₹25</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.radioOption, deliveryType === 'STORE_PICKUP' && styles.radioOptionActive]}
              onPress={() => setDeliveryType('STORE_PICKUP')}
            >
              <Text style={styles.optionIcon}>🏬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Store Self-Pickup</Text>
                <Text style={styles.optionSub}>Skip delivery fees, pick up when ready</Text>
              </View>
              <Text style={[styles.optionPrice, { color: Colors.success }]}>FREE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address (if not store pickup) */}
        {deliveryType !== 'STORE_PICKUP' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Delivery Address in Ilkal</Text>

            {/* Quick preset chips */}
            <View style={styles.presetsRow}>
              {ILKAL_PRESET_ADDRESSES.map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.presetChip, address === preset && styles.presetChipActive]}
                  onPress={() => setAddress(preset)}
                >
                  <Text style={[styles.presetText, address === preset && styles.presetTextActive]} numberOfLines={1}>
                    📍 {preset.split(',')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.addressInput}
              multiline
              numberOfLines={3}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter complete house no, street, landmark in Ilkal..."
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Payment Method</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.paymentBtn, paymentMethod === 'UPI' && styles.paymentBtnActive]}
              onPress={() => setPaymentMethod('UPI')}
            >
              <Text style={styles.paymentIcon}>📱</Text>
              <Text style={[styles.paymentText, paymentMethod === 'UPI' && styles.paymentTextActive]}>
                UPI (GPay/PhonePe)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentBtn, paymentMethod === 'COD' && styles.paymentBtnActive]}
              onPress={() => setPaymentMethod('COD')}
            >
              <Text style={styles.paymentIcon}>💵</Text>
              <Text style={[styles.paymentText, paymentMethod === 'COD' && styles.paymentTextActive]}>
                Cash on Delivery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentBtn, paymentMethod === 'CARD' && styles.paymentBtnActive]}
              onPress={() => setPaymentMethod('CARD')}
            >
              <Text style={styles.paymentIcon}>💳</Text>
              <Text style={[styles.paymentText, paymentMethod === 'CARD' && styles.paymentTextActive]}>
                Card / NetBanking
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bill Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Bill Summary</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{itemTotal}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Delivery Fee {deliveryType === 'STORE_PICKUP' ? '(Self Pickup)' : ''}
            </Text>
            <Text style={[styles.billValue, deliveryFee === 0 && { color: Colors.success, fontWeight: '700' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform Convenience Fee</Text>
            <Text style={styles.billValue}>₹{platformFee}</Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>

        {/* Customer Account Indicator */}
        <View style={styles.userFootnote}>
          <Text style={styles.userFootnoteText}>
            Logged in as: <Text style={{ fontWeight: '700' }}>{user?.phone || 'Guest Customer'}</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Checkout Bottom Bar */}
      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.checkoutBarSub}>Total Amount</Text>
          <Text style={styles.checkoutBarTotal}>₹{grandTotal}</Text>
        </View>

        <TouchableOpacity
          style={styles.placeOrderActionBtn}
          disabled={loading}
          onPress={handlePlaceOrder}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.placeOrderActionText}>Place Order →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 110,
    gap: Spacing.md,
  },
  storeBar: {
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeBarLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  storeBarName: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    marginTop: 2,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.slate100,
  },
  clearBtnText: {
    ...Typography.captionBold,
    color: Colors.danger,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    marginBottom: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  vegTag: {
    fontSize: 12,
  },
  itemName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.slate900,
  },
  itemUnitPrice: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyBtnText: {
    color: Colors.primaryDark,
    fontWeight: '700',
    fontSize: 15,
  },
  qtyNum: {
    color: Colors.primaryDark,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  itemSubtotal: {
    ...Typography.bodyBold,
    color: Colors.slate900,
    minWidth: 45,
    textAlign: 'right',
  },
  optionsCol: {
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.slate50,
    gap: 12,
  },
  radioOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionTitle: {
    ...Typography.subheadBold,
    color: Colors.slate900,
  },
  optionSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  optionPrice: {
    ...Typography.subheadBold,
    color: Colors.slate800,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.slate100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  presetText: {
    ...Typography.caption,
    color: Colors.slate700,
  },
  presetTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  addressInput: {
    backgroundColor: Colors.slate50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    ...Typography.subhead,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  paymentRow: {
    gap: 8,
  },
  paymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.slate50,
    gap: 12,
  },
  paymentBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  paymentIcon: {
    fontSize: 18,
  },
  paymentText: {
    ...Typography.subheadBold,
    color: Colors.slate700,
  },
  paymentTextActive: {
    color: Colors.primaryDark,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  billLabel: {
    ...Typography.subhead,
    color: Colors.textMuted,
  },
  billValue: {
    ...Typography.subhead,
    color: Colors.slate900,
    fontWeight: '500',
  },
  billDivider: {
    height: 1,
    backgroundColor: Colors.slate200,
    marginVertical: Spacing.md,
  },
  grandTotalLabel: {
    ...Typography.bodyBold,
    color: Colors.slate900,
  },
  grandTotalValue: {
    ...Typography.title3,
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  userFootnote: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  userFootnoteText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
  },
  checkoutBarSub: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  checkoutBarTotal: {
    ...Typography.title2,
    color: Colors.slate900,
    fontWeight: '800',
  },
  placeOrderActionBtn: {
    backgroundColor: '#ff8a16',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  placeOrderActionText: {
    ...Typography.bodyBold,
    color: Colors.white,
    fontWeight: '800',
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.title2,
    color: Colors.slate900,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...Typography.subhead,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.xl,
  },
  exploreBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  exploreBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  successCard: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  successTitle: {
    ...Typography.title1,
    color: Colors.success,
    marginBottom: 4,
  },
  successSub: {
    ...Typography.subhead,
    color: Colors.slate600,
    marginBottom: Spacing.lg,
  },
  orderMetadataBox: {
    width: '100%',
    backgroundColor: Colors.slate50,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.slate200,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    ...Typography.captionBold,
    color: Colors.textMuted,
  },
  metaValue: {
    ...Typography.subheadBold,
    color: Colors.slate900,
  },
  otpNotice: {
    backgroundColor: Colors.primaryTint,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  otpNoticeText: {
    ...Typography.caption,
    color: Colors.primaryDark,
    textAlign: 'center',
    fontWeight: '600',
  },
  trackOrderBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  trackOrderBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
  doneBtn: {
    backgroundColor: Colors.slate900,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    ...Typography.bodyBold,
    color: Colors.white,
  },
});
