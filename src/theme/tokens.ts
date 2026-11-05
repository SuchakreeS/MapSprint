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
  },
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 28 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Font family names as registered in src/theme/fonts.ts.
// Roles: Manrope = body, Sora = headings, Rajdhani = big numbers, Michroma = logo/labels only.
export const fonts = {
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  heading: 'Sora_600SemiBold',
  headingBold: 'Sora_700Bold',
  display: 'Rajdhani_600SemiBold',
  displayBold: 'Rajdhani_700Bold',
  label: 'Michroma_400Regular',
} as const;

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

export const type = {
  hudNumber: { fontFamily: fonts.displayBold, fontSize: 96, lineHeight: 100 },
  statNumber: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  title: { fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 34 },
  heading: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.label, fontSize: 11, lineHeight: 16, letterSpacing: 1.2 },
} as const satisfies Record<string, TextStyleToken>;
