// Keeps the user on the right onboarding step (src/lib/onboarding.ts decides which).
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from './auth-provider';

/** Onboarding screens that make no sense once setup is finished. `location` is not here: Record reuses it. */
const SETUP_ONLY = new Set(['welcome', 'sign-in', 'about-you', 'car']);

export function OnboardingGuard() {
  const { ready, route, userId } = useAuth();
  const segments = useSegments() as string[];
  const group = segments[0];
  const screen = segments[1];

  useEffect(() => {
    if (!ready) return;
    const inOnboarding = group === '(onboarding)';

    if (route === 'tabs') {
      if (inOnboarding && screen && SETUP_ONLY.has(screen)) router.replace('/');
      return;
    }
    if (inOnboarding && (screen === route || (route === 'welcome' && screen === 'sign-in'))) return;

    if (route === 'welcome') router.replace('/welcome');
    else if (route === 'about-you') router.replace('/about-you');
    else if (route === 'car') router.replace('/car');
    else if (userId) router.replace({ pathname: '/location', params: { step: '3', of: '5' } });
    else router.replace('/location');
  }, [ready, route, group, screen, userId]);

  return null;
}
