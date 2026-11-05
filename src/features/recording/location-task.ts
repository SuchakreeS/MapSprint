// Background location task. Imported from index.ts so it is registered before
// the UI mounts. Runs inside the Android foreground service while recording.
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { GpsPoint } from '@/lib/geo';

import { getActiveSessionId, insertPoints } from './db';

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
  insertPoints(sessionId, data.locations.map(toGpsPoint));
});
