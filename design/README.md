# Mapsprint design reference (Sport Luxe v2)

The approved designs for all 29 launch screens, exported from the design canvas so agents
can open them from the repo. **Look at the screen image before building a screen.**

- `screens/dark/NN-name.png`: **Onyx** (dark) version, 780 px wide (2x of a 390 pt frame)
- `screens/light/NN-name.png`: **Pearl** (light) version, same layout
- `overview-dark.png`, `overview-light.png`: all 29 screens on one sheet (open this first)
- `source/*.dc.html`: the design source for each screen. Reference only (not runnable, needs a
  design runtime we don't have). Read it for **exact** font sizes, paddings, radii, colours and
  the SVG icon paths. Layout is inline CSS in a template with `{{ ... }}` bindings.
  `KitTabBar.dc.html` is the bottom tab bar used on tab screens.

Colours live in `src/theme/tokens.ts` (`dark` = Onyx, `light` = Pearl). Never hard-code hex in
components. Units are metric (km, km/h). App follows the system theme with a Dark / Light /
System switch in Settings (screen 26, default System).

## Screen index

"Task" = step in `plan.md`. "Route" = where it goes under `src/app/`; routes marked *(suggested)*
are not decided in plan.md yet.

| # | Screen | Task | Route |
|---|--------|------|-------|
| 01 | Welcome | 2.2 | `(onboarding)/welcome` |
| 02 | Sign up / Log in | 2.2 | `(onboarding)/sign-in` |
| 03 | Location permission | **1.3**, 2.2 | `(onboarding)/location` |
| 04 | Profile setup | 2.2 | `(onboarding)/profile` |
| 05 | Add your car | 2.2 | `(onboarding)/car` |
| 06 | Privacy zones | 2.2 | `(onboarding)/zones` |
| 07 | Pre-drive check | **1.4** | `record/pre-drive` |
| 08 | Driving HUD | **1.5** | `record/hud` |
| 09 | Saving drive | 2.3 | `record/saving` |
| 10 | Drive Recap (full scroll, 390x1240) | 1.7 (local), 3.6 | `record/recap` |
| 11 | Share drive | 3.6 | `record/share` |
| 12 | Feed | 4.2 | `(tabs)/feed` |
| 13 | Drive detail | 4.2 | `drive/[id]` *(suggested)* |
| 14 | Comments (bottom sheet) | 4.2 | `drive/[id]/comments` *(suggested)* |
| 15 | Notifications | 4.3 | `notifications` *(suggested)* |
| 16 | Find friends | 4.4 | `find-friends` *(suggested)* |
| 17 | Explore map | 3.8 | `(tabs)/map` |
| 18 | Districts | 3.8 | `districts` *(suggested)* |
| 19 | Leaderboards | 4.5 | `(tabs)/ranks` |
| 20 | My profile | 4.6 | `(tabs)/profile` |
| 21 | Drive history | 1.7 (local), 4.6 | `history` *(suggested)* |
| 22 | Badges | 3.6, 4.6 | `badges` *(suggested)* |
| 23 | Garage | 4.6 | `garage` *(suggested)* |
| 24 | Other profile | 4.4 | `user/[handle]` *(suggested)* |
| 25 | Followers / Following | 4.1 | `user/[handle]/followers` *(suggested)* |
| 26 | Settings | 4.6 | `settings/index` *(suggested)* |
| 27 | Privacy settings | 4.6 | `settings/privacy` *(suggested)* |
| 28 | Recording settings | 4.6 | `settings/recording` *(suggested)* |
| 29 | Account & data | 4.6 | `settings/account` *(suggested)* |

Tab bar (all tab screens): Feed, Map, **Record** (big yellow centre button), Ranks, Profile.

## Visual rules (from the source)

- Frame 390 x 844 pt. Screens 12-29 scroll inside the frame; the image shows the first screen
  only. Build with safe areas and flexible layouts, not fixed pixel sizes.
- Fonts: **Sora** (titles), **Manrope** (body, buttons), **Rajdhani** (numbers: speed, stats,
  tabular), **Michroma** (wordmark / brand label only). Loaded with expo-font (task 1.1).
- Sport yellow `#FFC20E` is the single primary action colour in Onyx; Pearl uses black buttons
  with yellow text. Champagne gold is for secondary accents and badges.
- Minimum touch target 44 pt. Every icon-only button needs an accessibility label.
- Maps in the images are mock drawings. Real maps use Mapbox with the **blueprint fog**
  (grid fill, dark polygon with explored holes, road outlines). See plan.md 3.4.

## Known differences and warnings (read before building)

1. **Screen 03 copy is outdated.** It says Android will ask twice and to choose "Allow all the
   time", and that location is collected "when the app is closed". We now use a foreground
   service with the "while using the app" permission only (CLAUDE.md). Rewrite that copy and keep
   an honest data-use disclosure. Run the final wording past an Opus session (privacy / PDPA).
2. **App name.** Images and source still say "Cartrava" (screens 01, 02, 03, 28, tab titles).
   The working name is **Mapsprint** and is not final. Put the name in one constant, never inline.
3. **Sample data is fake** (users Mint, Beam, Fah..., drives, XP). Never ship it.
4. **Safety:** speed is never ranked or rewarded. Top speed is private to the owner and can NOT be shared (PS 2026-11-12: the "Share max speed" row on screen 27 is dropped; plan 3.10).
   HUD controls lock above 10 km/h and "Hold to finish" needs an 800 ms press (screen 08).
5. **Not designed yet:** empty states, error states, loading skeletons, tablet layouts, and the
   Update 1 premium screens (cosmetics, deeper stats, paywall).
6. The interactive prototype and the early theme explorations (JDM, Rally, Outrun, etc.) are not
   included; only the chosen Sport Luxe v2 screens.
