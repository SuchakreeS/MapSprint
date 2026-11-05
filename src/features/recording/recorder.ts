// Start / stop drive recording.
// Uses a user-started foreground service with a notification. Per expo-location
// (LocationModule.kt), this needs only the "while using the app" permission,
// NOT ACCESS_BACKGROUND_LOCATION, so we avoid Google Play's background-location review.
import * as Location from 'expo-location';

import { APP_NAME } from '@/constants/app';

import { endActiveSession, getActiveSessionId, startSession } from './db';
import { LOCATION_TASK } from './location-task';

export async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.granted;
}

export async function isRecording(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

export async function startRecording(): Promise<number> {
  if (!(await ensureForegroundPermission())) {
    throw new Error('Location permission is needed to record a drive.');
  }
  if (await isRecording()) {
    const active = getActiveSessionId();
    if (active != null) return active;
  }
  const id = startSession(Date.now());
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    mayShowUserSettingsDialog: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Recording your drive',
      notificationBody: `${APP_NAME} is recording GPS. Open the app to finish.`,
      notificationColor: '#FFC20E',
      killServiceOnDestroy: false,
    },
  });
  return id;
}

export async function stopRecording(): Promise<void> {
  if (await isRecording()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  endActiveSession(Date.now());
}
