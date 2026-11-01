import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text } from 'react-native';
import { Colors } from '@ownlocal/ui';

export default function AdminLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.slate900 },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Ilkal Control Tower',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.replace('/')} style={{ marginRight: 12 }}>
              <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>← Roles</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
