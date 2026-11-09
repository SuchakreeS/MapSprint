// Native Google sign-in (account picker) -> ID token for Supabase (signInWithIdToken).
// The native module is loaded lazily: an older APK without it shows a clear error instead of crashing at start.

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export class GoogleSignInError extends Error {}

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let mod: GoogleModule | null = null;
let configured = false;

async function load(): Promise<GoogleModule> {
  if (!mod) {
    try {
      mod = await import('@react-native-google-signin/google-signin');
    } catch {
      throw new GoogleSignInError('Google sign-in needs the latest version of the app.');
    }
  }
  if (!configured) {
    if (!WEB_CLIENT_ID) throw new GoogleSignInError('Google sign-in is not set up (missing web client ID).');
    // webClientId = the Web client from Google Cloud: needed to get an ID token for the server.
    mod.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  return mod;
}

/** Shows the Google account picker. Returns the ID token, or null if the user cancelled. */
export async function googleIdToken(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await load();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null; // cancelled
    if (!res.data.idToken) throw new GoogleSignInError('Google did not return a sign-in token. Please try again.');
    return res.data.idToken;
  } catch (e) {
    if (e instanceof GoogleSignInError) throw e;
    if (isErrorWithCode(e)) {
      console.warn('[google-signin]', e.code, e.message);
      if (e.code === statusCodes.IN_PROGRESS) return null;
      // Android DEVELOPER_ERROR (code 10): the app's SHA-1 / package / client IDs don't match Google Cloud.
      if (e.code === '10' || e.code === 'DEVELOPER_ERROR') {
        throw new GoogleSignInError('Google sign-in is not set up for this build of the app (developer error).');
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError('Google Play services are missing or out of date on this phone.');
      }
    }
    throw new GoogleSignInError('Google sign-in failed. Check your connection and try again.');
  }
}

/** Forget the chosen Google account so the next sign-in shows the account picker again. */
export async function googleSignOut(): Promise<void> {
  try {
    const { GoogleSignin } = await load();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or an older APK: nothing to clear.
  }
}
