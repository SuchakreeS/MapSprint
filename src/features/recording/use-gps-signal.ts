import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { signalQuality, type SignalQuality } from '@/lib/gps-signal';

/** Live GPS quality while the screen is open. Needs foreground location permission. */
export function useGpsSignal(): { quality: SignalQuality; accuracyM: number | null } {
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
      (loc) => setAccuracyM(loc.coords.accuracy),
    )
      .then((s) => {
        if (alive) sub = s;
        else s.remove();
      })
      .catch(() => {
        // No permission or GPS off: stay on "searching".
      });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  return { quality: signalQuality(accuracyM), accuracyM };
}
