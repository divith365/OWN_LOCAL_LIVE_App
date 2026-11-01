import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '@ownlocal/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={Colors.primaryDark} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'OWNLOCAL LIVE',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(customer)"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="(merchant)/index"
          options={{
            title: 'Merchant Dashboard',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="(rider)/index"
          options={{
            title: 'Rider Console',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="(admin)/index"
          options={{
            title: 'Admin Operations',
            headerShown: true,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
