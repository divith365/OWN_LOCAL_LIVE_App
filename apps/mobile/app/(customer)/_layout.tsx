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
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Roles</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Ilkal Marketplace',
        }}
      />
      <Stack.Screen
        name="merchant/[id]"
        options={{
          title: 'Store & Menu',
        }}
      />
    </Stack>
  );
}
