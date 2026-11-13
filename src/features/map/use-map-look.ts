// TEMPORARY (2026-11-13): the saved "Map style (test)" choice. Re-read whenever the screen gets focus, so the Map tab (which
// stays mounted) picks up a change made in Settings. HUD and Pre-drive mount fresh each time. Remove with src/lib/map-look.ts.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getMapLook } from '@/features/settings/prefs';
import type { MapLook } from '@/lib/map-look';

export function useMapLook(): MapLook {
  const [look, setLook] = useState<MapLook>(getMapLook);
  useFocusEffect(
    useCallback(() => {
      setLook(getMapLook());
    }, []),
  );
  return look;
}
