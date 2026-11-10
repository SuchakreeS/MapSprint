// Start / stop drive recording.
// Uses a user-started foreground service with a notification. Per expo-location
// (LocationModule.kt), this needs only the "while using the app" permission,
// NOT ACCESS_BACKGROUND_LOCATION, so we avoid Google Play's background-location review.
import * as Location from 'expo-location';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { APP_NAME } from '@/constants/app';
import { getSelectedVehicleId } from '@/features/settings/prefs';
import { planLaunchCleanup, planStart } from '@/lib/recording-state';

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

const TAG = '[recorder]';
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** True while expo-location's task is registered (it reads expo-task-manager's registry, which survives app restarts). */
export async function isRecording(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}

const TASK_OPTIONS: Location.LocationTaskOptions = {
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
};

const startUpdates = () => Location.startLocationUpdatesAsync(LOCATION_TASK, TASK_OPTIONS);

export async function startRecording(): Promise<number> {
  if (!(await ensureForegroundPermission())) {
    throw new Error('Location permission is needed to record a drive.');
  }
  const plan = planStart({ updatesRunning: await isRecording(), activeSessionId: getActiveSessionId() });
  if (plan.kind === 'reuse') return plan.sessionId;
  await ensureNotificationPermission();
  if (plan.kind === 'resume') {
    // The drive is open but GPS is not running (Android dropped the task). Same drive, GPS back on.
    console.warn(TAG, `drive ${plan.sessionId} was open without GPS updates: resuming it`);
    await startUpdates();
    return plan.sessionId;
  }
  // The car chosen on the pre-drive screen (per account; guests have none).
  const owner = getCurrentOwner();
  const id = startSession(Date.now(), owner ? getSelectedVehicleId(owner) : null);
  await startUpdates();
  return id;
}

/**
 * Turns GPS and the foreground service ("Recording your drive") off.
 *
 * Why not just stopLocationUpdatesAsync: in expo-location (SDK 58, taskConsumers/LocationTaskConsumer.kt) unregistering
 * removes the GPS updates but stops the service only through `mService`, a binding the consumer makes in
 * maybeStartForegroundService(), which runs only while the app is in front. If Android killed and restarted the app
 * process during the drive (Samsung, phone parked), the restored consumer is created in the background and never binds,
 * and expo-task-manager does not forward onHostResume to it while the headless JS instance is alive. Then unregister
 * leaves the service and its notification behind. Re-registering with the same options while the app is in front makes
 * the consumer bind; unregistering right after stops the service (the consumer stops it when the bind completes after
 * the unregister). Errors are logged with the tag and rethrown, never swallowed.
 */
export async function stopLocationService(): Promise<void> {
  let reattached = false;
  if (AppState.currentState === 'active') {
    try {
      await startUpdates();
      reattached = true;
    } catch (e) {
      // e.g. location permission revoked: fall back to a plain stop.
      console.warn(TAG, 're-attach before stop failed:', errText(e));
    }
  }
  if (!reattached && !(await isRecording())) return;
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch (e) {
    console.error(TAG, 'stopLocationUpdatesAsync failed:', errText(e));
    throw e;
  }
}

/** App launch: GPS left running with no open drive (e.g. an earlier stop failed) is switched off. */
export async function cleanUpRecorderOnLaunch(): Promise<void> {
  try {
    const action = planLaunchCleanup({ updatesRunning: await isRecording(), activeSessionId: getActiveSessionId() });
    if (action === 'stop-orphan') {
      console.warn(TAG, 'GPS task running with no open drive: stopping it');
      await stopLocationService();
    }
  } catch (e) {
    console.error(TAG, 'launch cleanup failed:', errText(e));
  }
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

/**
 * Finish. GPS goes off first; if that fails the drive stays open and the error reaches the HUD, so Finish can be
 * pressed again (no drive is lost either way).
 */
export async function stopRecording(): Promise<void> {
  await stopLocationService();
  endActiveSession(Date.now());
  await clearFinishReminder();
}
