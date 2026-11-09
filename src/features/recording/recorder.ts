// Start / stop drive recording.
// Uses a user-started foreground service with a notification. Per expo-location
// (LocationModule.kt), this needs only the "while using the app" permission,
// NOT ACCESS_BACKGROUND_LOCATION, so we avoid Google Play's background-location review.
import * as Location from 'expo-location';
import { PermissionsAndroid, Platform } from 'react-native';

import { APP_NAME } from '@/constants/app';
import { getSelectedVehicleId } from '@/features/settings/prefs';

import {
  endActiveSession,
  getActiveSessionId,
  getCurrentOwner,
  getManualPauseSince,
  insertPauseEvent,
  setManualPauseSince,
  startSession,
} from './db';
import { clearFinishReminder } from './finish-reminder';
import { LOCATION_TASK } from './location-task';

export async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.granted;
}

/**
 * Android 13+ (API 33) hides the foreground-service notification ("Recording your drive") unless
 * POST_NOTIFICATIONS was granted at runtime; declaring it in app.json is not enough. Recording works
 * either way, so a "no" never blocks a drive. After two refusals Android stops showing the dialog.
 */
export async function ensureNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (await PermissionsAndroid.check(perm)) return;
    await PermissionsAndroid.request(perm);
  } catch (e) {
    console.warn('[recorder] notification permission', e);
  }
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
  await ensureNotificationPermission();
  // The car chosen on the pre-drive screen (per account; guests have none).
  const owner = getCurrentOwner();
  const id = startSession(Date.now(), owner ? getSelectedVehicleId(owner) : null);
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

/**
 * Manual pause: stops the clock and, until resumed, the location task stores no points.
 * The foreground service keeps running. Does nothing if there is no drive or it is already paused.
 */
export function pauseRecording(): void {
  const sessionId = getActiveSessionId();
  if (sessionId == null || getManualPauseSince() != null) return;
  const now = Date.now();
  setManualPauseSince(now);
  insertPauseEvent(sessionId, now, 'pause');
}

/** Ends a manual pause, or an auto-pause (the engine ignores it if the drive is running). */
export function resumeRecording(): void {
  const sessionId = getActiveSessionId();
  if (sessionId == null) return;
  setManualPauseSince(null);
  insertPauseEvent(sessionId, Date.now(), 'resume');
}

export async function stopRecording(): Promise<void> {
  if (await isRecording()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  endActiveSession(Date.now());
  void clearFinishReminder();
}
