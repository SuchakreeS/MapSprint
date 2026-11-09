// Where the app should be, given who is using it and which setup steps are done (design 01-05).
//   nobody yet   -> welcome
//   guest        -> location (once) -> tabs            (never profile or car)
//   account      -> location -> about-you -> car -> tabs

export interface OnboardingState {
  signedIn: boolean;
  /** Chose "Continue as guest" on this phone. Ignored once signed in. */
  guest: boolean;
  /** Location step answered on this phone (allowed, or "Not now"). */
  locationDone: boolean;
  /** The account's profile has a username (set on step 04, or earlier on another phone). */
  hasUsername: boolean;
  /** Car step finished or skipped (or the account already existed before this phone). */
  carDone: boolean;
}

export type OnboardingRoute = 'welcome' | 'location' | 'about-you' | 'car' | 'tabs';

export function nextRoute(s: OnboardingState): OnboardingRoute {
  if (!s.signedIn && !s.guest) return 'welcome';
  if (!s.locationDone) return 'location';
  if (!s.signedIn) return 'tabs';
  if (!s.hasUsername) return 'about-you';
  if (!s.carDone) return 'car';
  return 'tabs';
}
