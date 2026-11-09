# 2.2 Auth + onboarding — design

_2026-11-09 · decided with PS in a brainstorming session · plan.md task 2.2_

## Intent
Mapsprint gets accounts so drives, map and badges can sync (2.3) and social features can work later (Phase 4).
Recording must stay instant: a new user can record their first drive without making an account.
The backend from 2.1 (Supabase project `gwcutbwcmxcwpgndaphi`, RLS proven by 37 pgTAP tests) is the security
boundary; the app only ever uses the publishable key.

## Goals
- Sign up / log in with **email + password** and **Google** (native account picker).
- **Continue as guest**: full recording without an account.
- Onboarding for signed-in users: location permission, profile (username, display name, optional photo), first car.
- A guest who later signs up keeps their local drives; they are uploaded to the new account in 2.3 and go through the
  same server checks as any drive (no XP shortcut via guest mode).
- One native rebuild that also brings the tab-bar icons.

## Non-goals (this task)
- Email confirmation / 6-digit codes, password reset emails (need a domain + email service; later).
- Uploading drives (2.3), the server function (2.4).
- Privacy zones screen (06): moved to Phase 4, see "Gates".
- Apple sign-in, iOS.
- Settings screens beyond a minimal Sign out (4.6).

## Anti-goals (would be a failure even if it "works")
- Recording blocked or slowed by auth (no network at first launch must still allow recording as guest).
- Any secret in the app or repo (Google client secret, Supabase secret/service_role key).
- A guest's or another account's local drives uploaded to the wrong account.
- Speed shown as an achievement anywhere in the new copy (CLAUDE.md safety rule).

## Decided by PS
1. **Guest mode.** Welcome screen offers "Continue as guest".
2. **Guests can:** record, HUD, the stats recap after a drive, drive history. **Guests cannot:** 3D drive replay
   (3.9), badges, Feed, Ranks, following. Those places show an unlock card (see my calls).
3. **Guest drives move into the account** when the guest signs up (upload itself in 2.3).
4. **No email confirmation for the first batch.** Sign up and continue. Add a confirmation code when there is a
   domain + email budget. Accepted side effects: forgot-password can't send emails; someone could register an
   email address that isn't theirs.
5. **Profile photo optional.** Offered on the profile step; without a photo the letter avatar (first letter of the
   display name, design 04) is used. Can be changed later.
6. **Tab-bar icons** (design `KitTabBar`) ship in the same native rebuild.
7. **Privacy zones** are not part of onboarding now. When built: map centred on the current location with a draggable
   pin (no address search), 200/300/500 m radius as in design 06.
8. Google OAuth is set up by PS: Google Cloud project "Mapsprint", Google Auth Platform (External, Testing mode,
   scopes openid/email/profile), a Web client (redirect URI `https://gwcutbwcmxcwpgndaphi.supabase.co/auth/v1/callback`)
   and one Android client (package `com.suchakree.mapsprint`, SHA-1 `5D:49:C5:AB:04:3C:37:33:9E:BE:5D:FF:B9:B8:C6:77:69:88:6A:31`,
   same for EAS preview and development). Supabase Google provider: Client IDs = `WEB,ANDROID` (web first), secret =
   web client secret, Skip nonce check OFF. **Web client ID** (goes in the app, not secret):
   `888394550731-kdqskcqrosfiqtlcftcvlopgn8m0om5t.apps.googleusercontent.com` (PS to confirm it is the Web one).

9. **Google-only for the first batch** (after the builder check). With Confirm email OFF Supabase implicitly confirms
   every email sign-up, and automatic identity linking merges a later Google sign-in with the same email into that
   account (no setting disables auto-linking). So a stranger could pre-register someone's Gmail and later read their
   drives. Email screens are built but hidden by `EMAIL_AUTH_ENABLED = false`, AND the Email provider is disabled in
   Supabase so the API can't be called directly. Re-enable both only together with a confirmation code.
10. **Local drive ownership.** Guest drives go to the next account that signs up or logs in on the phone. Signing out
    returns to Welcome and hides that account's drives on the phone (never uploaded to anyone else) until it logs back
    in. (This supersedes the "first account" wording under My calls.)

## Screens and flow
Designs: `design/screens/{dark,light}/01..05-*.png`, exact values in `design/source/`. Replace "Cartrava" with
`APP_NAME` (`src/constants/app.ts`).

| # | Route (existing placeholder) | Content |
|---|---|---|
| 01 | `(onboarding)/welcome` | Continue with Google (primary) · Sign up with email · "Already have an account? Log in" · **Continue as guest** (quiet text link under Log in) · terms footer |
| 02 | `(onboarding)/sign-in` | Sign up / Log in segmented tabs, email, password (show/hide eye), rule "At least 8 characters, with one number", primary button, "or", Continue with Google. Opened with the tab preselected from 01 |
| 03 | `(onboarding)/location` | Already built in 1.3; shown with `?step=3&of=5` |
| 04 | `(onboarding)/about-you` | Username (`@`, lowercase, 3–20, `a-z 0-9 _ .`, live "available"/"taken" check), display name (≤ 40), avatar circle with camera button (optional photo) |
| 05 | `(onboarding)/car` | Car preview tinted with the chosen colour, nickname, make, model, 8 colour swatches, Continue, Skip for now |

**Flows**
- New account (email or Google): 01 → 02 (or Google sheet) → 03 → 04 → 05 → tabs. Progress bar "Step N of 5".
- Guest: 01 → "Continue as guest" → 03 → tabs. Guest never sees 04/05.
- Returning user on a new phone: 01 → Log in → if their profile already has a username → tabs (03 only if location
  permission isn't granted yet, then tabs).
- Signed-in user whose profile has no username (killed the app mid-onboarding): resumes at 04.
- App start with a stored session → tabs directly (no welcome). Guest choice is remembered on the phone.
- Guest upgrades later from the Profile tab ("Create account") or any unlock card → 02 → 04 → 05 → back where they were.

## My calls (PS can override)
- **Guest link placement** on 01: quiet text link under "Log in".
- **Unlock card** instead of hiding tabs: Feed, Ranks and the locked parts show a short card ("Make an account to
  …") with a button to 02. Tabs stay visible.
- **"Step N of 5"** (06 moved out).
- **Google library:** `@react-native-google-signin/google-signin`, free "Original" `GoogleSignin` API, `webClientId` =
  the Web client ID, then `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`. The library page
  notes the underlying Android SDK is deprecated but functional; the paid "Universal" API is not used. Nonce: start
  without; if Supabase rejects the token, revisit (pass a nonce, or Skip nonce check).
- **Photo:** `expo-image-picker` (square crop), resized on the phone to 512×512 JPEG before upload. Stored in a new
  Supabase Storage bucket `avatars`, path `<user_id>/avatar.jpg`. Bucket readable by signed-in users only; write,
  replace and delete only inside your own `<user_id>/` folder; max 1 MB; JPEG/PNG/WebP only. `profiles.avatar_url`
  holds the storage path. RLS on `storage.objects` covered by new pgTAP tests.
- **Car colour:** new column `vehicles.colour` (text, one of 8 keys matching the design swatches, default the yellow).
  New migration; pgTAP updated. Make/model stay free text.
- **Username availability:** query `profiles` by username while typing (debounced); the unique constraint is the
  final check and a clash at save time shows "taken".
- **Local drive ownership (protects anti-goal 3):** the phone remembers which account each local drive belongs to.
  Guest drives have no owner and are claimed by the first account that signs in on the phone. Signing out keeps drives
  on the phone but they stay tied to their account; a different account signing in later does not get them.
- **Sign out:** a single "Sign out" row on the Profile tab (full settings come in 4.6). Sign out also signs out of the
  Google picker so the next Google sign-in shows the account chooser.
- **Password rule** (only matters once email is enabled): 8+ characters with a letter and a number, enforced in the
  app and in Supabase Auth settings ("letters and digits", minimum length 8; check the exact option name in the
  dashboard then). Hint copy: "At least 8 characters, with a letter and a number."
- **Welcome copy:** "Track your speed, explore new roads…" in design 01 conflicts with the safety rule; use
  "Track your drives, explore new roads and level up with friends." (PS can change the wording.)
- **Icons:** `react-native-svg`, paths copied from `design/source/` (tab bar + camera + mail + eye glyphs used here).

## Constraints
- Expo SDK 58: verify every Expo/library API in current docs before use (AGENTS.md); install with `npx expo install`.
- New native modules (Google sign-in, image picker, image resize if separate, svg) → one EAS rebuild; Expo Go can't run them.
- No hex colours outside `src/theme`; no RN imports in `src/lib`; routes only in `src/app`.
- Pure logic test-first in `src/lib` (password rule, username rule, letter-avatar initial, onboarding next-step
  resolver, local drive ownership rules).
- Database changes as new migrations; run `npx supabase test db` locally and `--remote` after `db push --remote`.
- Supabase Auth dashboard settings PS must set: Confirm email OFF, password minimum length 8 + require digits.

## Gates written into plan.md
- **Privacy zones (design 06) must ship before the Feed (4.2)** — nobody sees other people's routes before then.
- **Account deletion + privacy policy** are required for the Google Play closed test (2.6 / 5.2): note in plan.md.
- **Email service + confirmation code + password reset** before public launch (5.x).
- Google Auth Platform: add closed testers as test users, or publish the app (basic scopes, no review), before 2.6.

## Left to the builder
File layout under `src/features/auth/`, the auth state hook/provider shape, how the route guard is wired in Expo Router,
debounce timing, error message wording (plain, short), loading states, the exact unlock-card copy.
