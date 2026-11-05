import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getActiveSessionId } from './db';

const POLL_MS = 3000;

/** True while a drive is being recorded (also after the app was left or restarted). */
export function useDriveInProgress(): boolean {
  const [active, setActive] = useState(() => getActiveSessionId() != null);

  useEffect(() => {
    const read = () => setActive(getActiveSessionId() != null);
    const timer = setInterval(read, POLL_MS);
    // Re-read the moment the app comes back to the front.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  return active;
}
