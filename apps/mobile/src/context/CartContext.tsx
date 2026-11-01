import React, { createContext, useContext, useState, useMemo } from 'react';
import { Product } from '@ownlocal/types';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  merchantId: string | null;
  merchantName: string | null;
  items: CartItem[];
  itemCount: number;
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  grandTotal: number;
  addItem: (product: Product, merchant: { id: string; name: string }) => boolean;
  updateQuantity: (productId: string, delta: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType>({
  merchantId: null,
  merchantName: null,
  items: [],
  itemCount: 0,
  itemTotal: 0,
  deliveryFee: 25,
  platformFee: 5,
  grandTotal: 30,
  addItem: () => false,
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
});

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (product: Product, merchant: { id: string; name: string }): boolean => {
    // Single merchant per order constraint
    if (merchantId && merchantId !== merchant.id) {
      return false; // Signals conflicting merchant
    }

    if (!merchantId) {
      setMerchantId(merchant.id);
      setMerchantName(merchant.name);
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    return true;
  };

  const updateQuantity = (productId: string, delta: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === productId);
      if (!existing) return prev;

      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        const filtered = prev.filter((i) => i.product.id !== productId);
        if (filtered.length === 0) {
          setMerchantId(null);
          setMerchantName(null);
        }
        return filtered;
      }

      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: newQty } : i
      );
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.product.id !== productId);
      if (filtered.length === 0) {
        setMerchantId(null);
        setMerchantName(null);
      }
      return filtered;
    });
  };

  const clearCart = () => {
    setItems([]);
    setMerchantId(null);
    setMerchantName(null);
  };

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const itemTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const deliveryFee = itemCount > 0 ? 25 : 0;
  const platformFee = itemCount > 0 ? 5 : 0;
  const grandTotal = itemTotal + deliveryFee + platformFee;

  return (
    <CartContext.Provider
      value={{
        merchantId,
        merchantName,
        items,
        itemCount,
        itemTotal,
        deliveryFee,
        platformFee,
        grandTotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
