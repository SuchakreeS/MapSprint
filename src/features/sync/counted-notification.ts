// "Your drive is counted" local notification, for a drive that had to wait for signal (see shouldNotifyCounted).
// No permission prompt here: the Android 13 notification permission is asked when a drive starts (recorder.ts).
// If it was refused, Android just does not show this, which is fine.
import { AndroidImportance, scheduleNotificationAsync, setNotificationChannelAsync } from 'expo-notifications';

import { formatDistanceKm } from '@/lib/format';

const CHANNEL_ID = 'drive-counted';
/** Tapping the notification opens the recap of that drive (root layout reads this). */
export const COUNTED_KIND = 'drive-counted';

export async function notifyDriveCounted(sessionId: number, distanceM: number): Promise<void> {
  try {
    await setNotificationChannelAsync(CHANNEL_ID, { name: 'Counted drives', importance: AndroidImportance.DEFAULT });
    await scheduleNotificationAsync({
      identifier: `${COUNTED_KIND}-${sessionId}`,
      content: {
        title: 'Your drive is counted',
        body: `${formatDistanceKm(distanceM, 1)} km saved to your account. Tap to see it.`,
        data: { kind: COUNTED_KIND, sessionId },
      },
      trigger: { channelId: CHANNEL_ID }, // channel-only trigger = deliver now
    });
  } catch (e) {
    console.warn('[counted-notification]', e instanceof Error ? e.message : e);
  }
}
