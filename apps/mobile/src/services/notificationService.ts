import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from '../api';

// Configure how incoming notifications appear in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register device for push notifications and return token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#ff8a16',
        sound: 'default',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    return tokenData?.data || null;
  } catch (err) {
    console.warn('Push notification registration error (simulator or offline):', err);
    return null;
  }
}

/**
 * Register and sync push token with backend D1 database
 */
export async function syncPushTokenWithBackend(metadata: {
  userId?: string;
  role?: string;
  merchantId?: string;
  riderId?: string;
}): Promise<string | null> {
  const token = await registerForPushNotificationsAsync();
  if (token) {
    try {
      await apiClient.registerPushToken({
        token,
        userId: metadata.userId,
        role: metadata.role,
        merchantId: metadata.merchantId,
        riderId: metadata.riderId,
      });
    } catch (err) {
      console.warn('Could not register push token with backend:', err);
    }
  }
  return token;
}

/**
 * Trigger local instant notification chime
 */
export async function triggerLocalOrderAlert(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: null, // immediate
    });
  } catch (err) {
    console.warn('Could not trigger local notification:', err);
  }
}
