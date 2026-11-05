# CLAUDE.md — rules for every agent working on Mapsprint

## Start of every session (mandatory)
1. Read `handoff.md` FIRST. It says where the last session stopped and what to do next.
2. Read only the `plan.md` step(s) handoff.md points to. Do not re-read the whole repo.
3. Read `AGENTS.md` (Expo rules: SDK 58, never trust memory for Expo APIs, use `npx expo install`).

## Which model to use
- **Planning, architecture decisions, and security testing / review** (RLS policies, auth,
  Edge Functions, anti-cheat, privacy zones, PDPA data handling): use **Opus** with **high** effort.
- **Coding features and fixing bugs**: use **Sonnet** with **medium** effort.
- If a Sonnet session hits a design question or a security-sensitive change, stop, note it in
  `handoff.md`, and hand it to an Opus session.

## Build phase: use the Superpowers skills
During any build work, use the Superpowers skills (obra/superpowers plugin) where they apply:
- `brainstorming` before designing anything not already decided in plan.md
- `writing-plans` / `executing-plans` to break a plan.md step into small tasks
- `test-driven-development` for pure logic (src/lib, scoring, cleaning, XP)
- `systematic-debugging` for any bug
- `verification-before-completion` before marking a step done (run `npm run typecheck`, `npx eslint .`, `npm test`)
- `requesting-code-review` at the end of each phase
If the plugin is not installed, tell the user and follow the same discipline manually.

## End of every session / before usage runs out (mandatory)
Update `handoff.md`: what was done, files touched, test results, exact next step, open questions.
Keep it short. Tick finished steps in plan.md.

## Project facts
- Working name: **Mapsprint** (was Cartrava; name not final, trademark checks pending).
- Android first. Expo SDK 58, RN 0.88, TypeScript, Expo Router (routes in `src/app/`).
- Builds: EAS cloud (`npx eas-cli@latest build --profile development -p android`). Never edit `android/`/`ios/` by hand.
- Test phone: Samsung (needs Battery → Unrestricted for screen-off GPS).
- Recording = foreground service with notification. Needs only "while using" location permission.
  `isAndroidBackgroundLocationEnabled` stays **false** (avoids Google Play background-location review).
- Theme: Sport Luxe tokens in `src/theme/tokens.ts`. No hard-coded colours in components.
- Fog of war = blueprint style. H3 resolution 9 (avg edge ≈ 200 m, area ≈ 0.105 km²).
- Safety: never reward or rank speed. Controls lock above 10 km/h.
- Metric units only.
- User: PS, works ~10 h/week, prefers casual "bro" tone, bash on Windows.
