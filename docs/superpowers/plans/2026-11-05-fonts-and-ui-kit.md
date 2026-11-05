# Fonts + Shared UI Kit (plan.md task 1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the four Sport Luxe fonts and ship a small shared UI kit (Button, Card, Stat, Switch, Header) built only from `src/theme` tokens.

**Architecture:** Typography goes into `tokens.ts` (font family names + type scale); `use-theme.ts` exposes it. Fonts load at runtime with `useFonts` from the `@expo-google-fonts/*` packages (no native rebuild needed; `expo-font` is already in the dev build). Display formatting for Stat lives in a pure `src/lib/format.ts` (TDD, metric only). Components sit in `src/components/` and read colours via `useTheme()`.

**Tech Stack:** Expo SDK 58, RN 0.88, expo-font, expo-splash-screen, @expo-google-fonts/{sora,rajdhani,manrope,michroma}, node:test.

**Spec:** Conversation 2026-11-05 + plan.md task 1.1. Font roles (confirmed by PS): Manrope = body, Sora = headings, Rajdhani = big HUD numbers (speed, stats), Michroma = logo and small labels only.

## Global Constraints

- No hex colours outside `src/theme`. No RN imports in `src/lib`.
- Metric units only. Speed is never rewarded or ranked (Stat is display only, no "fast" styling).
- Never edit `android/` or `ios/`. Install deps with `npx expo install`.
- Done = `npm run typecheck`, `npx eslint .`, `npm test` all clean.
- Dark (Onyx) is the default mode; light (Pearl) must also look right.

## Review Focus

1. GPS speed arrives as `null` or negative (-1) when unknown: Stat shows `--`, never `-1` or `NaN`.
2. Distance/duration of 0 and very long drives (88 min run #6, >10 h): duration rolls to `H:MM:SS`, no `NaN`.
3. Font load error (offline-free, but asset failure): app still renders with system fonts, splash hides.
4. Disabled Button: no `onPress` fires, visibly dimmed, announced as disabled.
5. Touch targets: Button, Switch, Header back action are at least 48 dp high.

---

## File structure

- Create `src/lib/format.ts`: pure display formatting.
- Create `tests/format.test.mts`.
- Modify `src/theme/tokens.ts`: add `fonts`, `type` scale.
- Create `src/theme/fonts.ts`: `useAppFonts()` hook.
- Modify `src/theme/use-theme.ts`: also return `fonts`, `type`.
- Modify `src/app/_layout.tsx`: hold splash until fonts loaded or errored.
- Create `src/components/{Button,Card,Stat,Switch,Header}.tsx`.
- Create `src/app/kit.tsx`: temporary preview route, linked from spike hub; removed in task 1.12 with the spikes.
- Modify `package.json` (test script, deps).

---

### Task 1: Display formatting helpers (TDD)

**Files:**
- Create: `src/lib/format.ts`
- Test: `tests/format.test.mts`
- Modify: `package.json` (`test` script: append `tests/format.test.mts`)

**Interfaces:**
- Produces:
  - `formatSpeedKmh(kmh: number | null | undefined): string`
  - `formatDistanceKm(meters: number): string`
  - `formatDuration(seconds: number): string`

- [ ] **Step 1: Write failing tests** in `tests/format.test.mts` (same style as `geo.test.mts`):
  - `formatSpeedKmh(42.4) === '42'`, `formatSpeedKmh(0) === '0'`, `formatSpeedKmh(null) === '--'`, `formatSpeedKmh(undefined) === '--'`, `formatSpeedKmh(-1) === '--'`, `formatSpeedKmh(NaN) === '--'`
  - `formatDistanceKm(0) === '0.00'`, `formatDistanceKm(2370) === '2.37'`, `formatDistanceKm(9410.4) === '9.41'`, `formatDistanceKm(-5) === '0.00'`, `formatDistanceKm(NaN) === '0.00'`
  - `formatDuration(0) === '0:00'`, `formatDuration(65) === '1:05'`, `formatDuration(3599) === '59:59'`, `formatDuration(3600) === '1:00:00'`, `formatDuration(5327) === '1:28:47'`, `formatDuration(40000) === '11:06:40'`, `formatDuration(-3) === '0:00'`, `formatDuration(NaN) === '0:00'`
- [ ] **Step 2: Run** `npm test`. Expected: FAIL, cannot find `format.ts`.
- [ ] **Step 3: Implement** the three functions in `src/lib/format.ts`. Rule: invalid/negative input falls back to `'--'` (speed) or zero value (distance, duration); speed rounds to an integer, distance to 2 decimals.
- [ ] **Step 4: Run** `npm test`. Expected: all pass (geo + format).
- [ ] **Step 5: Commit** `feat(lib): display formatting for speed, distance, duration`

---

### Task 2: Typography tokens + font loading

**Files:**
- Modify: `src/theme/tokens.ts`, `src/theme/use-theme.ts`, `src/app/_layout.tsx`, `package.json`
- Create: `src/theme/fonts.ts`

**Interfaces:**
- Produces:
  - `fonts` in tokens: `{ body: string; bodyMedium: string; bodyBold: string; heading: string; headingBold: string; display: string; displayBold: string; label: string }` (family names as registered with `useFonts`, e.g. `Manrope_400Regular`, `Sora_600SemiBold`, `Rajdhani_600SemiBold`, `Michroma_400Regular`).
  - `type` in tokens: `Record<'hudNumber' | 'statNumber' | 'title' | 'heading' | 'body' | 'caption' | 'label', { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }>`. `hudNumber` ≈ 96 px, `statNumber` ≈ 32 px, others from a 28/20/16/13/11 scale.
  - `useAppFonts(): { ready: boolean }` where `ready` is true once fonts loaded **or** failed.
  - `useTheme()` returns `{ mode, c, fonts, type }`.

- [ ] **Step 1: Install** `npx expo install @expo-google-fonts/sora @expo-google-fonts/rajdhani @expo-google-fonts/manrope @expo-google-fonts/michroma`. Confirm the installed packages export the weights used (check each package's `index.d.ts`); adjust names in the interface above to what really exists.
- [ ] **Step 2: Add** `fonts` and `type` to `tokens.ts` (no RN imports, no hex).
- [ ] **Step 3: Implement** `useAppFonts` in `src/theme/fonts.ts` using `useFonts` from `@expo-google-fonts/*` re-exports (one combined map). Return `ready = loaded || error != null`.
- [ ] **Step 4: Update** `use-theme.ts` to return `fonts` and `type`.
- [ ] **Step 5: Update** `_layout.tsx`: `SplashScreen.preventAutoHideAsync()` at module level; `hideAsync()` in an effect when `ready`; render `null` until `ready`. Verify the exact `expo-splash-screen` API names against the SDK 58 docs before use.
- [ ] **Step 6: Verify** `npm run typecheck` and `npx eslint .` clean.
- [ ] **Step 7: Commit** `feat(theme): typography tokens and font loading`

---

### Task 3: UI kit components

**Files:**
- Create: `src/components/Button.tsx`, `Card.tsx`, `Stat.tsx`, `Switch.tsx`, `Header.tsx`, `src/app/kit.tsx`
- Modify: `src/app/index.tsx` (add a link to the kit preview), `src/app/_layout.tsx` (add `kit` screen title)

**Interfaces:**
- Consumes: `useTheme()` (Task 2), `formatSpeedKmh`/`formatDistanceKm`/`formatDuration` (Task 1), `space`, `radius`.
- Produces (all default-styled from tokens, each accepts an optional `style`):
  - `Button({ label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; })` — min height 48, `radius.md`, primary uses `accentFill`/`onAccent`.
  - `Card({ children; style? })` — `surface` background, `line` border, `radius.lg`, `space.lg` padding.
  - `Stat({ label: string; value: string; unit?: string; size?: 'hud' | 'normal' })` — value in `type.hudNumber` or `type.statNumber`, label in `type.label`, unit in `type.caption`. Takes **already formatted** strings so it stays dumb.
  - `Switch({ value: boolean; onValueChange: (v: boolean) => void; label: string })` — labelled row, 48 dp tall, uses RN `Switch` with token colours.
  - `Header({ title: string; onBack?: () => void })` — `type.heading` title, back button 48×48 when `onBack` given.
- All interactive components set `accessibilityRole` and `accessibilityState` (disabled/checked).

- [ ] **Step 1: Implement** the five components per the interfaces above. Colours only via `c.*`, fonts only via `type`/`fonts`.
- [ ] **Step 2: Build** `src/app/kit.tsx` showing each component in each variant, a `Stat` with `formatSpeedKmh(null)`, and a 5327 s duration; add the link on the spike hub and the stack title.
- [ ] **Step 3: Verify** `npm run typecheck` and `npx eslint .` clean; grep `src/components src/app/kit.tsx` for `#[0-9A-Fa-f]{3,8}` and expect no matches.
- [ ] **Step 4: Manual check** (PS, on the Samsung with Metro): open Kit, confirm the four fonts render distinctly, dark and light both look right (toggle phone theme), disabled Button does nothing.
- [ ] **Step 5: Commit** `feat(ui): Button, Card, Stat, Switch, Header kit and preview route`

---

### Task 4: Wrap up

- [ ] **Step 1:** Run `npm run typecheck`, `npx eslint .`, `npm test`; all must be clean.
- [ ] **Step 2:** Tick 1.1 in `plan.md` (note: kit preview route `src/app/kit.tsx` is removed under 1.12).
- [ ] **Step 3:** Update `handoff.md` (done, files touched, test results, next step = 1.2 routes, open questions).
- [ ] **Step 4:** Commit `docs: tick 1.1, update handoff`
