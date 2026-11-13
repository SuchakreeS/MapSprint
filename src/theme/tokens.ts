// Sport Luxe design tokens (Onyx = dark, Pearl = light).
// Every colour in the app comes from here so sellable themes later are just
// another token set. Never hard-code a hex value in a component.
export type Mode = 'dark' | 'light';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  accentFill: string;
  onAccent: string;
  gold: string;
  success: string;
  danger: string;
  /** Dimmed backdrop behind dialogs. */
  scrim: string;
  /** Dark, mostly opaque pill laid over the map (both themes) so `danger` text reads on any map colour. */
  overlayPill: string;
  /** Wide "explored road" band behind the route on the welcome art (design 01). */
  explored: string;
  /**
   * 3D buildings on the Map tab (only while 3D is on). Mapbox's night light dims every colour heavily, so the dark value is
   * deliberately bright: #1E1E1E and then #5A5A5A both still vanished into the ground on the phone (PS, 2026-11-13).
   */
  mapBuildings3d: string;
  /** Level bar LEDs (design 10 / 20): segments 1-5, 6-9 and 10-12 when lit. */
  ledLow: string;
  ledMid: string;
  ledHigh: string;
}

export const palettes: Record<Mode, Palette> = {
  dark: {
    bg: '#0A0A0A',
    surface: '#141414',
    surface2: '#1E1E1E',
    line: '#2C2C2C',
    text: '#F5F3EE',
    muted: '#A8A49A',
    primary: '#FFC20E',
    onPrimary: '#0A0A0A',
    primaryText: '#FFC20E',
    accentFill: '#FFC20E',
    onAccent: '#0A0A0A',
    gold: '#C9B37E',
    success: '#5BD48A',
    danger: '#FF6B5E',
    scrim: 'rgba(0,0,0,0.72)',
    overlayPill: 'rgba(10,10,10,0.9)',
    explored: '#1A1A1A',
    mapBuildings3d: '#D8D4CA',
    ledLow: '#E8E6E1',
    ledMid: '#FFC20E',
    ledHigh: '#FF453A',
  },
  light: {
    bg: '#F5F3EE',
    surface: '#FFFFFF',
    surface2: '#EEEBE4',
    line: '#DEDAD0',
    text: '#0E0E0E',
    muted: '#5C5850',
    primary: '#0E0E0E',
    onPrimary: '#FFC20E',
    primaryText: '#0E0E0E',
    accentFill: '#FFC20E',
    onAccent: '#0E0E0E',
    gold: '#7A5F1E',
    success: '#1E7F45',
    danger: '#B3261E',
    scrim: 'rgba(14,14,14,0.55)',
    overlayPill: 'rgba(10,10,10,0.9)',
    explored: '#E6E2D9',
    mapBuildings3d: '#EEEBE4', // = surface2: Pearl 3D is unchanged
    ledLow: '#3A3A3A',
    ledMid: '#B58100',
    ledHigh: '#C62828',
  },
};

/**
 * Car colours (design 05, ScrAddCar). Keys are stored in public.vehicles.colour (DB check constraint),
 * so keep this list and the migration in sync. Same in both themes: it is the car's paint.
 */
export const carColours = {
  pearl_white: { label: 'Pearl white', hex: '#F2F0EB' },
  onyx_black: { label: 'Onyx black', hex: '#151515' },
  silver: { label: 'Silver', hex: '#B8B8B8' },
  gunmetal: { label: 'Gunmetal', hex: '#4A4F55' },
  sport_yellow: { label: 'Sport yellow', hex: '#FFC20E' },
  racing_red: { label: 'Racing red', hex: '#C62828' },
  deep_blue: { label: 'Deep blue', hex: '#1F3A93' },
  forest_green: { label: 'Forest green', hex: '#1E4D2B' },
} as const;

export type CarColour = keyof typeof carColours;

export const radius = { sm: 12, notice: 14, md: 16, button: 18, lg: 20, xl: 28 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Font family names as registered in src/theme/fonts.ts.
// Roles: Manrope = body and labels, Sora = headings, Rajdhani = big numbers,
// Michroma = wordmark / brand label only (design/README.md).
export const fonts = {
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  heading: 'Sora_600SemiBold',
  headingBold: 'Sora_700Bold',
  display: 'Rajdhani_600SemiBold',
  displayBold: 'Rajdhani_700Bold',
  wordmark: 'Michroma_400Regular',
} as const;

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const type = {
  hudNumber: { fontFamily: fonts.displayBold, fontSize: 84, lineHeight: 84 },
  hudStat: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 28 },
  statNumber: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  headline: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 34 },
  statTile: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 31 },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 31 },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 29 },
  heading: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22 },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20 },
  buttonLarge: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  wordmark: { fontFamily: fonts.wordmark, fontSize: 11, lineHeight: 16, letterSpacing: 1.2 },
} as const satisfies Record<string, TextStyleToken>;
