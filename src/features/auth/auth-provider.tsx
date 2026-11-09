// Who is using the app (Google account, guest, or nobody yet) and how far onboarding got.
// Accounts are Google-only for now (EMAIL_AUTH_ENABLED in constants/app.ts, PS decision 2026-11-09).
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { claimGuestSessions, getCurrentOwner, setCurrentOwner } from '@/features/recording/db';
import { isRecording } from '@/features/recording/recorder';
import { supabase } from '@/features/sync/supabase';
import { nextRoute, type OnboardingRoute } from '@/lib/onboarding';

import { googleIdToken, googleSignOut } from './google';
import {
  isCarStepDone,
  isGuestChosen,
  isLocationStepDone,
  readProfileCache,
  setCarStepDone,
  setGuestChosen,
  setLocationStepDone,
  writeProfileCache,
  type CachedProfile,
} from './onboarding-flags';

export type Profile = CachedProfile;

interface AuthValue {
  /** False until the stored session, profile and permission state are known (keep the splash up). */
  ready: boolean;
  userId: string | null;
  email: string | null;
  /** Name from the Google account, to pre-fill the display name on step 04. */
  suggestedName: string | null;
  guest: boolean;
  profile: Profile | null;
  /** Where onboarding says the user should be (see src/lib/onboarding.ts). */
  route: OnboardingRoute;
  continueAsGuest: () => void;
  markLocationDone: () => void;
  markCarDone: () => void;
  refreshProfile: () => Promise<Profile | null>;
  /** Google account picker -> Supabase session. Resolves false if the user cancelled. */
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  /** True once the stored session has been read (getSession resolved). Gates `ready` and the owner effect. */
  const [loaded, setLoaded] = useState(false);
  /**
   * Signed in, but the stored session could not be refreshed because there is no network (expired access token
   * + offline cold start). Supabase then reports "no session", yet the account is still this phone's: keep
   * recording under it and use the cached profile. Cleared on SIGNED_OUT; replaced as soon as a refresh works.
   */
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null);
  const [guestChosen, setGuest] = useState(isGuestChosen);
  const [locationDone, setLocationDone] = useState(isLocationStepDone);
  const [permChecked, setPermChecked] = useState(false);
  /** Last profile fetched from the server, tagged with its owner so a stale one is never used for another user. */
  const [remote, setRemote] = useState<{ userId: string; profile: Profile } | null>(null);
  /** The user whose profile fetch has finished (success or offline failure). */
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [carDoneFor, setCarDoneFor] = useState<string | null>(null);
  /** Set during an interactive sign-in: an account that already has a username skips the car step. */
  const justSignedIn = useRef(false);

  const userId = session?.user.id ?? offlineUserId;

  // Stored session + live auth changes. No Supabase calls inside the callback (supabase-js warning).
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        // Offline with an expired access token: supabase-js returns no session plus a retryable error, but the
        // session is still in storage and the auto-refresh ticker restores it once the network is back.
        if (!data.session && error && isAuthRetryableFetchError(error)) setOfflineUserId(getCurrentOwner());
        setSession(data.session);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') setOfflineUserId(null);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Location already allowed (e.g. from Phase 1) counts as the location step done.
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (p.granted) {
          setLocationStepDone();
          setLocationDone(true);
        }
      })
      .catch(() => undefined)
      .finally(() => setPermChecked(true));
  }, []);

  // Account changed: tag new drives with it, take over guest drives, fetch the profile.
  useEffect(() => {
    if (!loaded) return; // don't wipe the stored owner before the stored session is known
    setCurrentOwner(userId);
    if (!userId) return;
    claimGuestSessions(userId);
    setGuestChosen(false);

    let alive = true;
    fetchProfile(userId)
      .then((p) => {
        if (!alive || !p) return;
        if (justSignedIn.current && p.username && !isCarStepDone(userId)) {
          setCarStepDone(userId); // returning user on a new phone: no car step
          setCarDoneFor(userId);
        }
        writeProfileCache(userId, p);
        setRemote({ userId, profile: p });
      })
      .catch(() => undefined) // offline: keep the cached profile (or none) and carry on
      .finally(() => {
        if (!alive) return; // a cancelled fetch must not reset the flag before the real one lands
        justSignedIn.current = false;
        setFetchedFor(userId);
      });
    return () => {
      alive = false;
    };
  }, [userId, loaded]);

  // Derived during render (no state copies): cached profile for offline starts, car step flag.
  const cached = useMemo(() => (userId ? readProfileCache(userId) : null), [userId]);
  const carStored = useMemo(() => (userId ? isCarStepDone(userId) : false), [userId]);
  const profile = remote && remote.userId === userId ? remote.profile : cached;
  const profileReady = !userId || fetchedFor === userId || cached != null;
  const carDone = !!userId && (carStored || carDoneFor === userId);
  const guest = !userId && guestChosen;

  const refreshProfile = useCallback(async () => {
    if (!userId) return null;
    const p = await fetchProfile(userId);
    if (p) {
      writeProfileCache(userId, p);
      setRemote({ userId, profile: p });
    }
    return p;
  }, [userId]);

  const signInWithGoogle = useCallback(async () => {
    const token = await googleIdToken();
    if (!token) return false;
    justSignedIn.current = true;
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) {
      justSignedIn.current = false;
      throw new Error('Could not sign in with Google. Please try again.');
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    if (await isRecording()) throw new Error('Finish your drive before signing out.');
    await googleSignOut();
    // 'local' = this phone only (the default 'global' would also sign out the user's other phones). supabase-js
    // removes the local session BEFORE the network call, so this works offline too; a failed server-side revoke
    // is not the user's problem.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setOfflineUserId(null);
    setGuestChosen(false);
    setGuest(false);
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuestChosen(true);
    setGuest(true);
  }, []);

  const markLocationDone = useCallback(() => {
    setLocationStepDone();
    setLocationDone(true);
  }, []);

  const markCarDone = useCallback(() => {
    if (!userId) return;
    setCarStepDone(userId);
    setCarDoneFor(userId);
  }, [userId]);

  const value: AuthValue = {
    ready: loaded && permChecked && profileReady,
    userId,
    email: session?.user.email ?? null,
    suggestedName:
      (session?.user.user_metadata?.full_name as string | undefined) ??
      (session?.user.user_metadata?.name as string | undefined) ??
      null,
    guest,
    profile,
    route: nextRoute({
      signedIn: userId != null,
      guest,
      locationDone,
      hasUsername: !!profile?.username,
      carDone,
    }),
    continueAsGuest,
    markLocationDone,
    markCarDone,
    refreshProfile,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
