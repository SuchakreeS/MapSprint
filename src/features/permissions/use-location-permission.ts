import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { permissionState, type PermissionState } from '@/lib/permission';

/** Foreground ("while using the app") location permission. `state` is null until first read. */
export function useLocationPermission() {
  const [state, setState] = useState<PermissionState | null>(null);

  const request = useCallback(async () => {
    const next = permissionState(await Location.requestForegroundPermissionsAsync());
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;
    const read = () =>
      Location.getForegroundPermissionsAsync().then((p) => {
        if (alive) setState(permissionState(p));
      });
    read();
    // Re-read when the user comes back from the phone's settings.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return { state, request, openSettings: () => Linking.openSettings() };
}
