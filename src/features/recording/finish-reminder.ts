// Locked-phone "Finish this drive?" reminder (plan 1.11 follow-up / 4.3 local part).
// The in-app dialog on the HUD only shows while the app is on screen. The foreground service keeps the location task
// running with the screen off, so the task calls maybeNotifyStillRecording() and we post a LOCAL notification
// (no push, no server) when the drive has sat stopped for a long time. Timing rules: src/lib/finish-prompt.ts.
import { AndroidImportance, dismissNotificationAsync, scheduleNotificationAsync, setNotificationChannelAsync } from 'expo-notifications';
import { AppState } from 'react-native';

import { APP_NAME } from '@/constants/app';
import { getFinishReminderOn } from '@/features/settings/prefs';
import { reminderPauseState, shouldPromptFinish, stoppedForMs } from '@/lib/finish-prompt';
import { CLEANING } from '@/lib/geo';

import { getFinishNotifiedAt, getLastMovingTs, getManualPauseSince, getSessionStartedAt, setFinishNotifiedAt } from './db';

const TAG = '[finish-reminder]';
const CHANNEL_ID = 'drive-reminders';
export const REMINDER_ID = 'finish-reminder';
/** Tapping the notification opens the HUD (root layout reads this). */
export const REMINDER_KIND = 'finish-reminder';
/** The task fires about once a second; the check only needs to run about once a minute. */
const CHECK_EVERY_MS = 60_000;

let lastCheckAt = 0;

export async function maybeNotifyStillRecording(sessionId: number, nowMs: number = Date.now()): Promise<void> {
  if (nowMs - lastCheckAt < CHECK_EVERY_MS) return;
  lastCheckAt = nowMs;
  // On screen: the HUD dialog already asks. Only the phone-locked / app-in-background case needs a notification.
  if (AppState.currentState === 'active') return;
  if (!getFinishReminderOn()) return;

  const startedAt = getSessionStartedAt(sessionId);
  if (startedAt == null) return;
  const pause = reminderPauseState({
    manualSince: getManualPauseSince(),
    lastMovingTs: getLastMovingTs(sessionId, CLEANING.stoppedBelowKmh / 3.6, CLEANING.maxAccuracyM),
    sessionStartMs: startedAt,
  });
  if (!shouldPromptFinish(pause, nowMs, getFinishNotifiedAt())) return;

  // Mark first: if posting fails or two checks overlap, the worst case is one missed reminder, never a spam loop.
  setFinishNotifiedAt(nowMs);
  try {
    await setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Drive reminders',
      importance: AndroidImportance.HIGH,
    });
    await scheduleNotificationAsync({
      identifier: REMINDER_ID, // one reminder at a time: a later one replaces this one
      content: {
        title: 'Finish this drive?',
        body: `You have been stopped for ${Math.floor(stoppedForMs(pause, nowMs) / 60_000)} min and ${APP_NAME} is still recording. Tap to finish or keep going.`,
        data: { kind: REMINDER_KIND },
      },
      trigger: { channelId: CHANNEL_ID }, // channel-only trigger = deliver now
    });
    console.log(TAG, `posted for drive ${sessionId} (stopped ${Math.round(stoppedForMs(pause, nowMs) / 60_000)} min)`);
  } catch (e) {
    // Visible in `adb logcat` (ReactNativeJS). The task itself keeps recording.
    console.error(TAG, 'posting failed:', e instanceof Error ? e.message : e);
  }
}

/** Remove the reminder once the drive is over. */
export async function clearFinishReminder(): Promise<void> {
  try {
    await dismissNotificationAsync(REMINDER_ID);
  } catch (e) {
    console.warn(TAG, 'dismiss failed:', e instanceof Error ? e.message : e);
  }
}
