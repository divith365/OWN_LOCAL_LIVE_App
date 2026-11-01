import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { Colors } from '@ownlocal/ui';

export default function CustomerLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Ilkal Marketplace',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ marginRight: 12 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Roles</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={() => router.push('/(customer)/orders' as any)}>
                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>📦 Orders</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(customer)/cart')}>
                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>🛒 Cart</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="merchant/[id]"
        options={{
          title: 'Store & Catalog',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="cart"
        options={{
          title: 'Review & Checkout',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="orders/index"
        options={{
          title: 'My Orders',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="orders/[id]"
        options={{
          title: 'Live Order Tracking',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
