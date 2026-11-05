# Mapsprint — step-by-step build plan for agents

Each step is small enough to finish in one short session. Tick `[x]` when done and
update `handoff.md`. Stop at any step boundary when usage runs low.
Verify every step: `npm run typecheck`, `npx eslint .`, `npm test`.

Reference: full product plan (Claude Docs) — goals, data model, screens, risks.
Designs: "Cartrava Theme Prototype" canvas, page "App screens · Sport Luxe v2" (29 screens).


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
├── tests/                     Node tests for pure logic (*.test.mts)
├── src/
│   ├── app/                   ROUTES ONLY (Expo Router)
│   │   ├── _layout.tsx        root stack, Mapbox token
│   │   ├── index.tsx, map.tsx, gps.tsx, h3.tsx   Phase 0 spikes (remove in Phase 1)
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
- [x] 1.4 Pre-drive check screen (07): GPS signal, battery tip, car, sound toggle
      (code done 2026-11-05; car row is a placeholder until Phase 2; on-phone check pending)
- [ ] 1.5 Driving HUD (08, v2 design): live speed (EMA), stats, Mapbox follow camera,
      "Hold to finish" (800 ms), Pause, controls lock > 10 km/h, expo-keep-awake while open
- [ ] 1.6 Auto-pause (stopped > 5 min) and manual pause in recorder
- [ ] 1.7 Local drive history list + local recap stats (no server yet)
- [ ] 1.8 Samsung/OEM battery-optimisation guide screen
- [ ] 1.9 Field test 10 drives, compare with trip meter; tune CLEANING constants
- [ ] 1.10 Gap log: store every gap > 3 s (time + position) per drive; show max gap in debug stats
- [ ] 1.11 "Finish this drive?" prompt after being stopped for a while (forgot-to-stop case, spike run #6)
- [ ] 1.12 Remove the spike screens (map / gps / h3) once real screens replace them

## Phase 2 — Backend (≈30 h) — gate: closed test starts (12+ testers, 14 days)
- [ ] 2.1 Supabase project (Singapore, free plan) + migrations for tables in plan doc
      (profiles, vehicles, drives, explored_cells, xp_events, badges, user_badges,
      follows, kudos, comments, privacy_zones) with RLS
- [ ] 2.2 Auth: Google + email/password; onboarding screens 01–06
- [ ] 2.3 Upload: gzipped raw track to Storage, drive row; offline queue + retry (Saving screen 09)
- [ ] 2.4 Edge Function `finalize-drive`: clean, recompute stats, simplify route
      (Douglas–Peucker 5 m), privacy-zone trimming, anti-cheat flags
- [ ] 2.5 Weekly DB backup GitHub Action
- [ ] 2.6 Play Console: app, foreground-service declaration, internal → closed test

## Phase 3 — Game (≈50 h)
- [ ] 3.1 XP rules (10/km, 25/new cell, smooth ×1.0–1.5, +50 first drive) — TDD in src/lib
- [ ] 3.2 Levels: XP for next level = 100 × level^1.5
- [ ] 3.3 H3 cells res 9 + gridPathCells; explored_cells upsert server-side
- [ ] 3.4 Blueprint fog layer in Mapbox (grid fill + road outlines, explored holes)
- [ ] 3.5 Smooth score (harsh accel > 0.3 g, brake < −0.35 g, corner > 0.4 g)
- [ ] 3.6 Badges (10 listed in plan doc) + Drive Recap screen (10) + Share drive (11)
- [ ] 3.7 Sounds (expo-audio) + voice lines (expo-speech, English)
- [ ] 3.8 Explore map (17) + Districts (18) with OSM boundaries for 4 launch provinces

## Phase 4 — Social (≈45 h)
- [ ] 4.1 Follows (private accounts, requests) + Followers screen (25)
- [ ] 4.2 Feed (12), Drive detail (13), Comments (14), kudos
- [ ] 4.3 Notifications (15) + push (expo-notifications)
- [ ] 4.4 Find friends (16), Other profile (24)
- [ ] 4.5 Leaderboards (19): Distance/Explorer/Smooth × Friends/Province, pg_cron weekly reset
- [ ] 4.6 Profile (20), History (21), Badges (22), Garage (23), Settings (26–29)

## Phase 5 — Launch (≈20 h)
- [ ] 5.1 Final name + trademark + domain; app icon
- [ ] 5.2 Privacy policy (PDPA), terms (traffic-law disclaimer), delete/export data
- [ ] 5.3 Store listing (English), screenshots, production release

## Update 1 — Premium (after launch, ≈40 h)
- [ ] U1.1 RevenueCat paywall, U1.2 Customise (car icons, map themes, badge frames),
      U1.3 Deeper stats, U1.4 Manage subscription
