# Mapsprint — step-by-step build plan for agents

Each step is small enough to finish in one short session. Tick `[x]` when done and
update `handoff.md`. Stop at any step boundary when usage runs low.
Verify every step: `npm run typecheck`, `npx eslint .`, `npm test`.

Reference: full product plan (Claude Docs) — goals, data model, screens, risks.
Designs: `design/` folder (29 screens, dark + light images, index in `design/README.md`). Open the screen image before building it.


## Tech stack
| Layer | Choice |
| --- | --- |
| App | Expo SDK 58, React Native 0.88, React 19, TypeScript, Expo Router (file routes in `src/app/`) |
| Builds | EAS cloud builds (`eas.json` profiles: development / preview / production), Android first |
| Map | `@rnmapbox/maps` 10.3 (Mapbox Maps SDK v11), public token in `.env` (`EXPO_PUBLIC_MAPBOX_TOKEN`) |
| GPS | `expo-location` + `expo-task-manager`, foreground service with notification (no background-location permission) |
| Local storage | `expo-sqlite` (every GPS point written immediately) |
| Hex grid | `h3-js` 4.5, resolution 9 |
| Screen | `expo-keep-awake` while the HUD is open |
| Sound (Phase 3) | `expo-audio` chimes, `expo-speech` voice lines (English) |
| Backend (Phase 2) | Supabase free plan (Singapore): Postgres + PostGIS, Auth (Google + email), Storage, Edge Functions (Deno), pg_cron |
| Payments (Update 1) | RevenueCat over Google Play Billing |
| Monitoring | Sentry (crashes), PostHog (analytics) |
| Quality | TypeScript strict, ESLint (`eslint-config-expo`), Node test runner for pure logic (`npm test`) |

## Folder structure
```
Cartrava/                      repo root (Expo project root)
├── CLAUDE.md                  agent rules (read first)
├── handoff.md                 session-to-session progress (read first)
├── plan.md                    this file
├── AGENTS.md                  Expo-specific agent rules
├── index.ts                   entry: registers background task, then expo-router
├── app.json / eas.json        Expo config + build profiles
├── .env.example               copy to .env (never commit .env)
├── assets/                    icons, splash, fonts (Phase 1), sounds (Phase 3)
├── design/                    approved screen images + source (read design/README.md)
├── tests/                     Node tests for pure logic (*.test.mts)
├── src/
│   ├── app/                   ROUTES ONLY (Expo Router)
│   │   ├── _layout.tsx        root stack, Mapbox token
│   │   ├── (onboarding)/      Phase 2: welcome, sign-in, location, profile, car, zones
│   │   ├── (tabs)/            Phase 1+: feed, map, ranks, profile (+ record button)
│   │   └── record/            Phase 1: pre-drive, hud, saving, recap, share
│   ├── features/              feature logic, no routes
│   │   ├── recording/         db.ts, location-task.ts, recorder.ts
│   │   ├── game/              Phase 3: xp, levels, badges, smooth score, cells
│   │   ├── social/            Phase 4: feed, follows, kudos, comments
│   │   └── sync/              Phase 2: upload queue, Supabase client
│   ├── components/            shared UI kit (Button, Card, Stat, Switch, Header)
│   ├── lib/                   pure functions (geo.ts …) — testable in Node, no RN imports
│   └── theme/                 tokens.ts (Sport Luxe), use-theme.ts, fonts
└── supabase/                  Phase 2: migrations/, functions/finalize-drive/, seed.sql
```
Rules: no colour hex outside `src/theme`; no RN imports in `src/lib`; never edit `android/` or `ios/`.

---

## Phase 0 — Spikes (gate: all three pass)
- [x] 0.1 Scaffold Expo SDK 58 + deps + app.json/eas.json (done session 1)
- [x] 0.2 GPS maths `src/lib/geo.ts` + tests (done)
- [x] 0.3 Recording pipeline: SQLite + background task + recorder (done)
- [x] 0.4 Spike screens: map / gps / h3 (done)
- [x] 0.5 User: `npm install`, `.env`, `git init`, EAS dev build, install on Samsung
- [x] 0.6 Spike 1 Mapbox: dark map + location puck show → PASS
- [x] 0.7 Spike 2 GPS: screen-off recording on the Samsung (Battery = Unrestricted) → PASS under revised rule (≥ 95% coverage, no repeated long gaps; best run max gap 2 s, longest 88 min). Details in handoff.md
- [x] 0.8 Spike 3 H3: all checks PASS on Hermes. If FAIL: move H3 to Edge Function only
- [x] 0.9 Record results in handoff.md (all three recorded 2026-11-05)

## Phase 1 — Recorder (≈45 h) — gate: distance within 2% of car trip meter on 10 drives
- [x] 1.1 Fonts (Sora, Rajdhani, Manrope, Michroma via expo-font) + shared UI kit
      (Button, Card, Stat, Switch, Header) from tokens
      (code done 2026-11-05; on-phone check of /kit preview still to do; kit route removed under 1.12)
- [x] 1.2 Expo Router structure: (onboarding) stack, (tabs) Feed/Map/Record/Ranks/Profile, modal record flow
      (code done 2026-11-05, placeholder screens; on-phone check pending)
- [x] 1.3 Location permission screen (design 03) + foreground permission flow
      (code done 2026-11-05, designed from tokens since no mockup; on-phone check pending)
      (the mockup exists now: design/screens 03. Its copy is outdated: ask for "while using the app" only. See 1.13)
- [x] 1.4 Pre-drive check screen (07): GPS signal, battery tip, car, sound toggle
      (code done 2026-11-05; car row is a placeholder until Phase 2; on-phone check pending)
- [x] 1.5 Driving HUD (08, v2 design) (code done 2026-11-05 in 3 parts 1.5a/b/c; on-phone test pending; Pause disabled until 1.6): live speed (EMA), stats, Mapbox follow camera,
      "Hold to finish" (800 ms), Pause, controls lock > 10 km/h, expo-keep-awake while open
- [x] 1.6 Auto-pause (stopped > 5 min) and manual pause in recorder (code done 2026-11-05; on-phone test pending)
- [x] 1.7 Local drive history list + local recap stats (no server yet) (code done 2026-11-05; on-phone test pending; XP/level/cells/smooth/badges left for Phase 3)
- [x] 1.8 Samsung/OEM battery-optimisation guide screen (code done 2026-11-05; on-phone test pending, steps based on dontkillmyapp.com)
- [ ] 1.9 Field test 10 drives, compare with trip meter; tune CLEANING constants
      (first data point 2026-11-05: 7.86 km vs 7.91 km on the same route 2 days earlier; 42 min drive, longest gap 2 s; still needs trip-meter comparisons)
- [x] 1.10 Gap log: store every gap > 3 s (time + position) per drive; show max gap in debug stats
      (code done 2026-11-05; derived from stored points, shown in the recap "GPS check" card; on-phone test pending)
- [x] 1.11 "Finish this drive?" prompt after being stopped for a while (forgot-to-stop case, spike run #6)
      (IN-APP ONLY, code done 2026-11-05: dialog on the HUD + "Drive in progress" pill on the tabs; PS decided the
      local NOTIFICATION version comes later with expo-notifications, see 4.3; on-phone test pending)
- [x] 1.12 Remove the spike screens (map / gps / h3) once real screens replace them (done 2026-11-09: also the /dev hub, /kit preview and the Profile link; h3-js stays for Phase 3)
- [x] 1.13 Design alignment pass (code done 2026-11-05, on-phone check pending; icons still undecided): 1.1-1.4 were built before `design/` existed. Compare the UI kit, tab bar,
      location (03) and pre-drive (07) screens with `design/screens/` + `design/source/` (sizes, radii, spacing, icons) and fix differences
- [x] 1.5d (code done 2026-11-06, on-phone check pending) HUD lock message: move "Controls are locked while you are moving." out of the bottom sheet to a pill at the TOP of the map,
      text in `c.danger` (red) on a dark pill, bottom sheet keeps a fixed height, Mapbox camera bottom padding = sheet height so the dot
      is never covered (PS feedback 2026-11-05, see handoff.md Session 5). Optional: show wall-clock vs active time on the recap header

## Phase 2 — Backend (≈30 h) — gate: closed test starts (12+ testers, 14 days)
- [x] 2.1 Supabase project (Singapore, free plan) + migrations for tables in plan doc
      (profiles, vehicles, drives, explored_cells, xp_events, badges, user_badges,
      follows, kudos, comments, privacy_zones) with RLS
      (done 2026-11-09: project Mapsprint gwcutbwcmxcwpgndaphi, 12 tables incl. drive_private, 37 pgTAP tests pass
      local + cloud, supabase-js client in src/features/sync, Security + Performance advisors clean;
      EAS env vars (expo.dev) still to add)
- [x] 2.2 Auth + onboarding (code done 2026-11-09; needs `db push --remote` + a native EAS build + on-phone test).
      Follow-up 2026-11-09: car picker on Pre-drive (07) done in code, drive stamped with `vehicle_id` locally; 2.3 must upload it. Phone test pending (testlist F9).
      Follow-up 2026-11-09: Garage (23) + Edit profile done in code (part of 4.6 pulled forward); avatar versioned-path migration needs `db push --remote`. Phone test pending (testlist F10).
      Spec `docs/superpowers/specs/2026-11-09-auth-onboarding-design.md`. GOOGLE-ONLY for now (email screens built but
      off: `EMAIL_AUTH_ENABLED`), guest mode, onboarding 01 → 03 → 04 → 05 (06 privacy zones moved to Phase 4),
      guest drives move to the next account, tab-bar icons (react-native-svg)
- [ ] 2.3 Upload: gzipped raw track to Storage, drive row; offline queue + retry (Saving screen 09)
- [ ] 2.4 Edge Function `finalize-drive`: clean, recompute stats, simplify route
      (Douglas–Peucker 5 m), privacy-zone trimming, anti-cheat flags
- [ ] 2.5 Weekly DB backup GitHub Action
- [ ] 2.6 Play Console: app, foreground-service declaration, internal → closed test
      GATES before the closed test (from 2.2): in-app account deletion (Play policy; also delete the user's
      `avatars/<uid>/` files, which do not cascade) + a privacy policy URL; Google Auth Platform: add the testers as
      test users or publish the app (basic scopes, no review); add the Play App Signing SHA-1 as another Android
      OAuth client and append its ID to Supabase's Google Client IDs

## Phase 3 — Game (≈65 h; was 50, +4 for spike 3.0, +10 for replay 3.9, my estimates)
- [ ] 3.0 Map style spike (do BEFORE 3.4; decision PS 2026-11-06): try Mapbox **Standard** style (built-in 3D buildings,
      day/dusk/night light presets) vs our current style. Check on the Samsung: can the blueprint fog (3.4) be layered
      on Standard (slots / custom layers), can 3D buildings be shown only inside explored cells (unexplored = flat
      blueprint), building-height coverage in Bangkok vs Pathum Thani, FPS and phone heat with pitch ~60°. Confirm
      Mapbox mobile billing is per MAU (3D should not add cost). Record the result in handoff.md, then pick the style.
- [ ] 3.1 XP rules (10/km, 25/new cell, smooth ×1.0–1.5, +50 first drive) — TDD in src/lib
- [ ] 3.2 Levels: XP for next level = 100 × level^1.5
- [ ] 3.3 H3 cells res 9 + gridPathCells; explored_cells upsert server-side
- [ ] 3.4 Blueprint fog layer in Mapbox (grid fill + road outlines, explored holes)
- [ ] 3.5 Smooth score (harsh accel > 0.3 g, brake < −0.35 g, corner > 0.4 g)
- [ ] 3.6 Badges (10 listed in plan doc) + Drive Recap screen (10) + Share drive (11)
- [ ] 3.7 Sounds (expo-audio) + voice lines (expo-speech, English)
- [ ] 3.8 Explore map (17) + Districts (18) with OSM boundaries for 4 launch provinces
- [ ] 3.9 3D drive replay (FREE, PS decision 2026-11-06): on the Drive Recap, a camera flyover along the route in 3D
      (pitched camera following the route bearing). Explored cells show 3D buildings, unexplored stay flat blueprint
      ("reveal the city"). The car is a **dot** (route line drawing itself + glowing dot at its tip), NOT a 3D car.
      Replay only, never during a live drive. Needs 3.0 and 3.4. Design for this screen not made yet.

## Phase 4 — Social (≈45 h)
- [ ] 4.1 Follows (private accounts, requests) + Followers screen (25)
- [ ] 4.2 Feed (12), Drive detail (13), Comments (14), kudos
      GATE (PS 2026-11-09): privacy zones screen (design 06: map centred on the current location + draggable pin,
      200/300/500 m) must ship BEFORE the Feed, so nobody's home/work shows on a shared route
- [ ] 4.3 Notifications (15) + push (expo-notifications)
      [local notification part: code done 2026-11-09 (Session 12), needs the new build + phone test F11]
      + LOCAL notification for the forgot-to-stop case ("Finish this drive?" when the phone is locked; the in-app
      version from 1.11 is done). Needs the new native library, so it triggers a rebuild. PS asked to note this (2026-11-05).
- [ ] 4.4 Find friends (16), Other profile (24)
- [ ] 4.5 Leaderboards (19): Distance/Explorer/Smooth × Friends/Province, pg_cron weekly reset
- [ ] 4.6 Profile (20), History (21), Badges (22), Garage (23), Settings (26–29)
      (partly done 2026-11-09: Garage (23), Edit profile, Settings hub + Recording + Privacy toggles + Account screen; still open: Notifications/Help/Terms rows, default visibility, blocked people, download/delete data, Profile 20 redesign, Badges 22)

## Phase 5 — Launch (≈20 h)
- [ ] 5.1 Final name + trademark + domain; app icon (icon artwork wired in 2026-11-06, needs a native build to see; name/trademark/domain still open)
- [ ] 5.2 Privacy policy (PDPA), terms (traffic-law disclaimer), delete/export data
      + email sign-up (from 2.2): email service + domain, 6-digit confirmation code, password reset; then turn on
      `EMAIL_AUTH_ENABLED` AND re-enable the Email provider + "Confirm email" in Supabase together
- [ ] 5.3 Store listing (English), screenshots, production release

## Update 1 — Premium (after launch, ≈58 h; was 40, +10 for U1.5, +8 for U1.6, my estimates)
- [ ] U1.1 RevenueCat paywall, U1.2 Customise (car icons, map themes, badge frames),
      U1.3 Deeper stats, U1.4 Manage subscription
- [ ] U1.5 Live 3D driving mode (PREMIUM, PS decision 2026-11-06): "driver view" camera behind and above the car
      (pitch ~60°, course bearing, puck low on screen), 3D buildings. 2D stays the default; the 2D/3D switch follows the
      HUD lock rule (only when stopped or < 10 km/h). Freeze camera bearing below 3 km/h (GPS course is noise).
      Glanceable only: no animations or popups while driving. Fall back to 2D on low battery / overheating.
- [ ] U1.6 3D car (PREMIUM): rule "if the map is 3D (live 3D mode), the car is 3D". Mapbox 3D model puck (glTF).
      Generic low-poly cars only (no real brand models: trademark risk). Later: match the Garage car, skins/colours
      (ties into U1.2). Premium users also get the 3D car in the replay (free users keep the dot).

## Later ideas (parked, NOT scheduled; PS decision 2026-11-09: stabilise the core app first)
- [ ] L.1 Caravan / group drive: invite friends, everyone records, members see each other live on the map; alerts when someone
      falls behind, stops too long or goes off route. Realtime positions are temporary (Supabase Realtime), not stored.
      Why parked: needs Phase 2 backend and friends first, costs money (Realtime message limits on the free plan: check
      current limits), and live location sharing needs a PDPA/privacy review (Opus). Safety rules if built: glanceable or
      voice alerts only, no chat, no speed ranking, HUD lock rule applies, invite-only, opt-in each time, auto-end when
      recording stops, privacy zones respected, group cap ~8-10. Open questions: friends-only or link/code, leader with
      destination or leaderless, free vs premium, live map vs group recap + XP first. Ideas: group recap on one map, shared
      explored cells, "stay together" XP, meeting-point pin.
      Pricing discussion (2026-11-09, PROPOSED, NOT decided): host pays. Anyone can JOIN a caravan for free, only premium users can
      CREATE one (cost follows the host, joiners must install the app = growth). Alternatives: all premium; all free; free small
      caravan (~3 people, short) + premium bigger (~8) with group recap and meeting pin. Cost-saving: send a position every ~5 s,
      skip when not moving, stop when recording stops, temporary messages only (nothing in the DB), cap ~8. Supabase Realtime
      limits on free vs paid: unverified, check pricing before building. Rough maths: 6 people x 1 h ~ 30k messages.
- [ ] L.2 Photoreal 3D (Google Photorealistic 3D Tiles via Cesium in a WebView): judged over-engineering for now
      (second map engine, Google billing and strict terms, battery). Revisit only if Mapbox Standard 3D (task 3.0) looks poor.
- [ ] L.3 Turn-by-turn navigation: DECIDED OUT (PS 2026-11-09). Thai users will use Google Maps / Waze for navigation and our app
      for records. Mapbox Navigation SDK v3 free tier is only 100 MAU + 1,000 trips/month (after that: per-MAU + per-trip fee,
      amounts not checked), it would also compete with our foreground-service recorder, and as far as I know `@rnmapbox/maps` is
      the map only (turn-by-turn would need another, less mature library; unverified). Possible cheap extras after launch:
      a "Navigate" button that opens Google Maps / Waze (free), and a route preview with the Directions API (100k free requests/month).
- [ ] L.4 Android Auto / car screen: NOT POSSIBLE for our app type. Google only allows media, messaging/calling, navigation, POI
      (parking/charging/fuel), IoT, weather (parked-only: video, games, browsers). Fitness/tracker apps are not allowed. Do not fake a
      media or navigation app to get onto the car screen (Play review risk). The phone is the HUD. Car-friendly part we can do: audio
      voice lines through the car speakers (task 3.7, expo-speech).
- [ ] L.5 Music controls in the HUD (PS 2026-11-09: low priority, probably skip). If ever built: send media key events only
      (play/pause/next/previous, works with any player, no permission, small native module = rebuild). No notification-access
      permission (heavy, privacy/PDPA, review risk). Per-service SDK (e.g. Spotify) only if really wanted. Conflict: the HUD locks
      controls above 10 km/h; steering-wheel buttons, Android Auto/Bluetooth and the lock screen already control music.
- [ ] L.6 Map Matching API (100k free requests/month): could snap the recap route / fog cells to roads later. Not for the distance
      number (that is what task 1.9 tests). I believe a request takes ~100 points, so simplify the track first (unverified, check docs).

## Mapbox free tiers (PS checked the Mapbox pricing page, 2026-11-09)
Maps SDKs for Mobile: free up to 25,000 monthly active users (price after that not checked). Navigation SDK v3: 100 MAU + 1,000 trips.
Directions, Map Matching, Optimization, Matrix, Isochrone: 100,000 requests (matrix: elements) each per month. Our map cost is
free for a long time; the Navigation SDK is the only tight limit, and it is out (L.3).
