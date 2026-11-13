// TEMPORARY (PS, 2026-11-13): "Map style (test)" switch so the dark-mode fog options can be compared on the phone without a
// rebuild. Remove this file, the Settings row, the pref and the `look` plumbing once PS has decided (see handoff.md).
// Only the dark theme (Onyx) changes; light (Pearl) is always the same.

export const MAP_LOOKS = ['dusk', 'night-tint', 'night'] as const;
export type MapLook = (typeof MAP_LOOKS)[number];

/** B "Dusk reveal" is the default; A is "night-tint"; "night" is the look before this change. */
export const DEFAULT_MAP_LOOK: MapLook = 'dusk';

export function parseMapLook(raw: string | null): MapLook {
  return (MAP_LOOKS as readonly string[]).includes(raw ?? '') ? (raw as MapLook) : DEFAULT_MAP_LOOK;
}

/** Mapbox Standard light preset. Pearl is always day; Onyx is dusk only for option B. */
export function lightPresetFor(mode: 'dark' | 'light', look: MapLook): 'day' | 'dusk' | 'night' {
  if (mode === 'light') return 'day';
  return look === 'dusk' ? 'dusk' : 'night';
}
