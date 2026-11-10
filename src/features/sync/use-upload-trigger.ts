// Starts the upload queue (2.3) while the app is open: when a user is signed in, when the app comes to the front,
// and every 30 s (covers "signal came back" without a network library). Guests never upload.
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';

import { runUploadQueue } from './upload-runner';

const POLL_MS = 30_000;

export function useUploadTrigger(): void {
  const { userId } = useAuth();
  useEffect(() => {
    if (!userId) return;
    void runUploadQueue();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void runUploadQueue();
    });
    const timer = setInterval(() => void runUploadQueue(), POLL_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [userId]);
}
