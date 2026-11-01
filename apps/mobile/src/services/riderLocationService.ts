import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiClient } from '../api';

export const RIDER_BG_LOCATION_TASK = 'OWNLOCAL_RIDER_BG_LOCATION';

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
        latestLoc.coords.longitude
      );
    } catch (err) {
      console.warn('Failed to broadcast background rider GPS:', err);
    }
  }
});

/**
 * Start background location tracking with Android Foreground Service notification
 */
export async function startBackgroundRiderTracking(): Promise<boolean> {
  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') return false;

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      console.warn('Background location permission not granted, continuing with foreground.');
      return false;
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_BG_LOCATION_TASK);
    if (!hasStarted) {
      await Location.startLocationUpdatesAsync(RIDER_BG_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000, // Update every 10 seconds
        distanceInterval: 15, // Or if moved by 15 meters
        deferredUpdatesInterval: 10000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'OwnLocal Delivery Partner Active 🛵',
          notificationBody: 'Broadcasting live GPS to nearby store orders.',
          notificationColor: '#ff8a16',
        },
      });
    }
    return true;
  } catch (err) {
    console.error('Error starting background rider tracking:', err);
    return false;
  }
}

/**
 * Stop background location tracking when rider goes offline
 */
export async function stopBackgroundRiderTracking(): Promise<void> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(RIDER_BG_LOCATION_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(RIDER_BG_LOCATION_TASK);
    }
  } catch (err) {
    console.error('Error stopping background rider tracking:', err);
  }
}
