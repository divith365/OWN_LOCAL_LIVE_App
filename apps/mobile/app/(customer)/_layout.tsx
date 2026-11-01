import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
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
            <TouchableOpacity onPress={() => router.push('/(customer)/cart')} style={{ marginLeft: 8 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>🛒 Cart</Text>
            </TouchableOpacity>
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
    </Stack>
  );
}
