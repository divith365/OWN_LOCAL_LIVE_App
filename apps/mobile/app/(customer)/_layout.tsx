import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, View } from 'react-native';
import { Colors } from '@ownlocal/ui';

export default function CustomerLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#073f7c' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
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
