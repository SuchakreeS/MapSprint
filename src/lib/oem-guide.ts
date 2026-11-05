// Per-phone-maker steps to stop Android killing the app while the screen is off (plan.md 1.8).
// Steps are based on dontkillmyapp.com (read 2026-11-05). Menus differ between models and
// Android versions, so the screen says so. Pure, no React Native imports.
import { APP_NAME } from '../constants/app.ts';

export type OemId =
  | 'samsung'
  | 'xiaomi'
  | 'oppo'
  | 'realme'
  | 'vivo'
  | 'huawei'
  | 'oneplus'
  | 'google'
  | 'other';

export interface OemGuide {
  id: Exclude<OemId, 'other'>;
  name: string;
  steps: string[];
  /** One honest caveat about this maker, shown under the steps. */
  note?: string;
}

export const OEM_GUIDES: OemGuide[] = [
  {
    id: 'samsung',
    name: 'Samsung',
    steps: [
      `Open Settings > Apps > ${APP_NAME} > Battery and choose Unrestricted. On older phones: Battery optimization > All apps > ${APP_NAME} > Don't optimize.`,
      'Open Settings > Battery > More battery settings and turn off Adaptive battery.',
      `Open Settings > Battery > Background usage limits. Add ${APP_NAME} to Never sleeping apps and turn off Put unused apps to sleep.`,
    ],
    note: 'After a big system update, check these again. Samsung can switch them back.',
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi, Redmi, POCO',
    steps: [
      `Allow auto-start: Settings > Apps > ${APP_NAME} > Autostart (older: Security > Permissions > Autostart). Turn ${APP_NAME} on.`,
      `Set battery to no limits: Settings > Apps > ${APP_NAME} > Battery saver > No restrictions (older: Security > Battery > App battery saver).`,
      `Open the recent apps screen and pull the ${APP_NAME} card down (or tap its lock) so it stays in memory.`,
    ],
    note: 'MIUI and HyperOS are the strictest about background apps. Menu names change between versions.',
  },
  {
    id: 'oppo',
    name: 'OPPO',
    steps: [
      `Allow auto-start: App info > ${APP_NAME} > Allow auto start-up.`,
      `Allow background use: App info > ${APP_NAME} > Battery usage > Allow run in background, and turn off battery optimization.`,
      `Open the recent apps screen and lock the ${APP_NAME} card.`,
    ],
  },
  {
    id: 'realme',
    name: 'Realme',
    steps: [
      `Open Settings > Battery > App battery management > ${APP_NAME} (older: Power saving settings > App battery management).`,
      'Turn on Allow auto-launch, Allow foreground activity and Allow background activity.',
      'Turn off Optimize battery use, and turn off Sleep stand-by optimization under Battery.',
    ],
  },
  {
    id: 'vivo',
    name: 'Vivo',
    steps: [
      `Allow auto-start: Settings > More settings > Applications > Autostart (older: i Manager > App manager > Autostart manager). Turn ${APP_NAME} on.`,
      `Open Settings > Battery > Background power consumption management and allow ${APP_NAME}. On newer phones also choose Unrestricted battery usage in the app's Battery settings.`,
      `Open the recent apps screen, swipe the ${APP_NAME} card down and tap the lock.`,
    ],
  },
  {
    id: 'huawei',
    name: 'Huawei, Honor',
    steps: [
      `Open Settings > Battery > App launch (older: Advanced settings > Battery manager > Protected apps) and set ${APP_NAME} to manage manually or Protected, with background activity on.`,
      `Open Settings > Apps > ${APP_NAME} > Battery. Turn off Power-intensive prompt and turn on Keep running after screen off.`,
      `Open Settings > Apps > Advanced > Ignore optimisations and allow ${APP_NAME}.`,
    ],
    note: 'Newer Huawei phones can still stop apps even with these settings, so recordings may end early.',
  },
  {
    id: 'oneplus',
    name: 'OnePlus',
    steps: [
      `Open the recent apps screen, long-press the ${APP_NAME} card and tap the lock.`,
      `Open Settings > Battery > Battery optimization > All apps > ${APP_NAME} > Don't optimize.`,
      'In Battery optimization, open the three dots > Advanced optimization and turn off Deep optimization (or Adaptive battery).',
    ],
    note: 'OnePlus sometimes resets these settings on its own, so check again if recording stops.',
  },
  {
    id: 'google',
    name: 'Google Pixel and other stock Android',
    steps: [
      `Open Settings > Apps > ${APP_NAME} > Advanced > Battery (it may be called App battery usage).`,
      `Choose Unrestricted, or in Battery optimization switch to All apps and set ${APP_NAME} to Not optimized.`,
      `Make sure Background restrictions is not turned on for ${APP_NAME}.`,
    ],
  },
];

/** Works out the phone maker from `Device.manufacturer` and `Device.brand`. */
export function detectOem(manufacturer: string | null | undefined, brand?: string | null): OemId {
  const text = `${manufacturer ?? ''} ${brand ?? ''}`.toLowerCase().trim();
  if (text.includes('samsung')) return 'samsung';
  if (/xiaomi|redmi|poco/.test(text)) return 'xiaomi';
  if (text.includes('realme')) return 'realme';
  if (text.includes('oppo')) return 'oppo';
  if (/vivo|iqoo/.test(text)) return 'vivo';
  if (/huawei|honor/.test(text)) return 'huawei';
  if (text.includes('oneplus')) return 'oneplus';
  if (/google|pixel/.test(text)) return 'google';
  return 'other';
}

/** Your phone's guide first (stock Android if unknown), the others after in their usual order. */
export function orderedGuides(id: OemId): OemGuide[] {
  const firstId = id === 'other' ? 'google' : id;
  const first = OEM_GUIDES.find((g) => g.id === firstId)!;
  return [first, ...OEM_GUIDES.filter((g) => g.id !== firstId)];
}
