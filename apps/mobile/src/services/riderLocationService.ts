import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiClient } from '../api';

export const RIDER_BG_LOCATION_TASK = 'OWNLOCAL_RIDER_BG_LOCATION';

let activeRiderId: string = 'rider_01';
let foregroundSubscription: Location.LocationSubscription | null = null;
let heartbeatInterval: any = null;

// Define the background task globally
TaskManager.defineTask(RIDER_BG_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data && data.locations && data.locations.length > 0) {
    const latestLoc = data.locations[data.locations.length - 1];
    try {
      await apiClient.riderUpdateLocation(
        latestLoc.coords.latitude,
        latestLoc.coords.longitude,
        activeRiderId
      );
    } catch (err) {
      console.warn('Failed to broadcast background rider GPS:', err);
    }
  }
});

/**
 * Start resilient rider location tracking:
 * 1. Active foreground high-precision watch
 * 2. Background task with Android Foreground Service notification
 * 3. 8-second heartbeat fallback
 */
export async function startBackgroundRiderTracking(riderId?: string): Promise<boolean> {
  if (riderId) activeRiderId = riderId;

  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;

    // 1. Initial Immediate GPS ping
    try {
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await apiClient.riderUpdateLocation(
        initialPos.coords.latitude,
        initialPos.coords.longitude,
        activeRiderId
      );
    } catch (e) {
      console.warn('Initial GPS ping failed:', e);
    }

    // 2. Foreground high-frequency watch
    if (!foregroundSubscription) {
      foregroundSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (loc) => {
          try {
            await apiClient.riderUpdateLocation(
              loc.coords.latitude,
              loc.coords.longitude,
              activeRiderId
            );
          } catch (err) {
            console.warn('Foreground GPS update failed:', err);
          }
        }
      );
    }

    // 3. Periodic Heartbeat
    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await apiClient.riderUpdateLocation(
            loc.coords.latitude,
            loc.coords.longitude,
            activeRiderId
          );
        } catch {
          // Ignore periodic error
        }
      }, 10000);
    }

    // 4. Background task (if background permission available)
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_BG_LOCATION_TASK);
        if (!hasStarted) {
          await Location.startLocationUpdatesAsync(RIDER_BG_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: 8000,
            distanceInterval: 10,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'OwnLocal Delivery Partner Active 🛵',
              notificationBody: 'Broadcasting live GPS to dispatch nearby orders.',
              notificationColor: '#ff8a16',
            },
          });
        }
      }
    } catch (bgErr) {
      console.warn('Background service setup skipped/unsupported:', bgErr);
    }

    return true;
  } catch (err) {
    console.error('Error starting rider tracking:', err);
    return false;
  }
}

/**
 * Stop background location tracking when rider goes offline
 */
export async function stopBackgroundRiderTracking(): Promise<void> {
  try {
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_BG_LOCATION_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(RIDER_BG_LOCATION_TASK);
    }
  } catch (err) {
    console.error('Error stopping rider tracking:', err);
  }
}
