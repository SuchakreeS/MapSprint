# Plan: Phase 2.2 — Auth (Google-only for now) + guest mode + onboarding

## Context
2.1 is done (Supabase project `gwcutbwcmxcwpgndaphi`, 12 tables, RLS proven by 37 pgTAP tests, supabase-js client in
`src/features/sync/supabase.ts`, nothing uses it yet). 2.2 adds accounts so drives can sync in 2.3. Design agreed with
PS on 2026-11-09: `docs/superpowers/specs/2026-11-09-auth-onboarding-design.md` (reviewed by a builder subagent).
Google OAuth is fully configured by PS (Web + Android clients in Supabase; Web client ID
`888394550731-kdqskcqrosfiqtlcftcvlopgn8m0om5t.apps.googleusercontent.com`).

Answers that changed the spec after review (PS, 2026-11-09):
- **Google-only for the first batch.** Email sign-up without confirmation allows account hijack via automatic identity
  linking (Supabase docs: Confirm email OFF implicitly confirms the email; Google sign-in with the same email links
  into that account; no setting disables auto-linking). Email screens are built but hidden behind a flag, AND the Email
  provider is disabled in Supabase so the API can't be used directly.
- **Local drive ownership:** guest drives go to the next account that signs up or logs in on the phone; signing out
  returns to Welcome and hides that account's drives (never uploaded to anyone else) until it logs back in.
- Password hint becomes "at least 8 characters, with a letter and a number" (matches Supabase's strength option; verify
  the exact option name in the dashboard when email is turned on later).

## Part A — JS + database (no native rebuild, testable now)
1. **Update the spec** with the three answers above (Google-only + flag, ownership rule, password copy).
2. **Migration `*_vehicles_colour_and_avatars.sql`** (+ pgTAP, raise `plan(n)`):
   - `vehicles.colour text not null default 'yellow' check (colour in (8 keys from design 05))`; add `colour` to the
     vehicles insert/update column grants.
   - Storage bucket `avatars` (private, 1 MB limit, jpeg/png/webp). Policies on `storage.objects`: select for
     `authenticated` where `bucket_id='avatars'`; insert/update/delete only where
     `(storage.foldername(name))[1] = (select auth.uid())::text`. Tests: A uploads to own folder, B can't write to A's.
   - `db reset`, `test db`, then PS: `db push --remote`, `test db --remote`; regenerate `database.types.ts`.
3. **Pure logic, test-first** (`src/lib`, Node tests in `tests/`):
   - `username.ts`: normalise (trim, lowercase) + validate (3–20, `a-z 0-9 _ .`), same rule as the DB check.
   - `avatar.ts`: letter initial from display name / username (fallback "?").
   - `onboarding.ts`: `nextRoute({ signedIn, guest, hasUsername, locationGranted, carStepDone })` → welcome / location /
     about-you / car / tabs (guest: welcome → location → tabs; returning user with username → tabs).
   - `drive-owner.ts`: `visibleTo(ownerId, currentUserId)` (guest sees only null-owner drives; account U sees only U's),
     claim rule (null → U on sign-in/up).
   - `password.ts`: rule for the hidden email form (8+, letter + digit).
4. **Local SQLite ownership** (`src/features/recording/db.ts`): add `sessions.owner_id TEXT NULL` (safe ALTER when
   missing, via `PRAGMA table_info`); kv `current_owner` set by the auth layer; `startSession` stamps it;
   `claimGuestSessions(userId)`; `loadDrives` / `drive-history.ts` / `useDriveInProgress` filter with `visibleTo`.
   Sign-out is disabled while a drive is recording.
5. **Auth layer** `src/features/auth/`: provider/hook over `supabase.auth.onAuthStateChange` + guest flag (kv, same
   pattern as `src/features/settings/prefs.ts`) + own profile row (username, display name, avatar_url) + sets
   `current_owner` and claims guest sessions on sign-in. `EMAIL_AUTH_ENABLED = false` in `src/constants/app.ts`.
6. **Routing guard** in `src/app/_layout.tsx` driven by `nextRoute` (check SDK 58 Expo Router docs for
   `Stack.Protected` vs `<Redirect>` before choosing).
7. **Screens** (designs 01, 02, 04, 05; `APP_NAME` instead of "Cartrava"; theme tokens only):
   - `(onboarding)/welcome` (01): Continue with Google, quiet "Continue as guest" link; email + "Log in" entries only
     when the flag is on. Copy: "Track your drives, explore new roads and level up with friends."
   - `(onboarding)/sign-in` (02): email/password tabs, built, reachable only with the flag on.
   - `(onboarding)/location` (03): existing screen, `?step=3&of=5`.
   - `(onboarding)/about-you` (04): username with debounced availability check (unique constraint is the final check),
     display name, optional photo (picker wired in Part B; letter avatar meanwhile).
   - `(onboarding)/car` (05): nickname, make, model, 8 colour swatches, tinted car preview, Skip for now.
   - `LockedFeature` unlock card on Feed and Ranks for guests (button → welcome / Google). Profile tab: account header
     (avatar or letter, display name, @username) or "Create account" for guests; "Sign out" row.
   - Remove the `zones.tsx` placeholder from the flow (screen comes with Phase 4).

## Part B — native rebuild (one EAS build)
8. `npx expo install @react-native-google-signin/google-signin expo-image-picker react-native-svg` (+ an image resize
   module only if the picker can't output 512×512 itself — check docs). Config plugins in `app.json`; check whether the
   google-signin plugin needs `iosUrlScheme` for an Android-only build.
9. Google sign-in: `GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID })` →
   `signIn()` → `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`. Sign-out also calls
   `GoogleSignin.signOut()`. Nonce: none first; if Supabase rejects, revisit.
10. Avatar: pick (square crop) → 512×512 JPEG → upload `avatars/<uid>/avatar.jpg` (upsert) → `profiles.avatar_url` =
    path; display via signed URL.
11. Tab-bar icons with `react-native-svg`, paths from `design/source/KitTabBar.dc.html` (+ camera/mail/eye glyphs).
12. Env `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`, `.env.example`, and EAS (PS).

## PS dashboard tasks
- Supabase → Authentication → Providers → **Email: disable** (closes the hijack path at the API).
- expo.dev env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- Google Auth Platform stays in Testing: PS's Gmail is a test user; testers added (or app published) before 2.6.

## Part C — docs
- plan.md: tick 2.2; add gates: privacy zones (06) before Feed 4.2; account deletion + privacy policy before Play
  closed test 2.6; email service + confirmation code + reset + re-enable Email provider before public launch;
  Google Auth Platform testers/publish before 2.6.
- handoff.md session entry; save this plan to `docs/superpowers/plans/2026-11-09-auth-onboarding.md`.

## Verification
- `npm run typecheck`, `npx eslint .`, `npm test` (112 + new lib tests), `npx supabase test db` local and `--remote`.
- Part A in the dev client / Metro before the rebuild: guest flow (welcome → location → tabs, Feed/Ranks show unlock
  card, recording works, drives listed), guest data stays after app restart.
- After the EAS preview build, on the Samsung: Google sign-in → location → profile (username taken/available, photo
  optional) → car → tabs; guest drives now under the account; sign out → welcome, drives hidden; sign back in → visible;
  log in on a fresh install → straight to tabs; recording and the notification still work; tab icons in dark + light.
