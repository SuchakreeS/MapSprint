// Working name, not final (trademark checks pending). Use this constant in all
// user-facing copy so a rename is a one-line change. app.json has its own copy.
export const APP_NAME = 'Mapsprint';

/**
 * Email + password sign-up/log-in (screen 02). OFF until email confirmation codes exist: without them a stranger
 * could pre-register someone's Gmail and Supabase would later link that person's Google sign-in into it
 * (PS decision 2026-11-09). Turn on only together with re-enabling the Email provider + "Confirm email" in Supabase.
 */
export const EMAIL_AUTH_ENABLED = false;
