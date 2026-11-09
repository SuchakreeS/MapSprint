// Background location task. Imported from index.ts so it is registered before
// the UI mounts. Runs inside the Android foreground service while recording.
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { GpsPoint } from '@/lib/geo';

import { getActiveSessionId, getManualPauseSince, insertPoints } from './db';
import { maybeNotifyStillRecording } from './finish-reminder';

export const LOCATION_TASK = 'mapsprint-location';

export function toGpsPoint(l: LocationObject): GpsPoint {
  return {
    ts: l.timestamp,
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    speed: l.coords.speed,
    accuracy: l.coords.accuracy,
    heading: l.coords.heading,
  };
}

TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[location-task]', error.message);
    return;
  }
  const sessionId = getActiveSessionId();
  if (sessionId == null || !data?.locations?.length) return;
  // While the driver has Pause on, nothing is stored. Points stamped before the pause began
  // (Android sometimes delivers them late, in a batch) are still kept.
  const pausedSince = getManualPauseSince();
  const locations =
    pausedSince == null ? data.locations : data.locations.filter((l) => l.timestamp < pausedSince);
  if (!locations.length) return;
  insertPoints(sessionId, locations.map(toGpsPoint));
  // Screen off and stopped for a long time? Post the "Finish this drive?" notification (throttled inside).
  await maybeNotifyStillRecording(sessionId);
});
