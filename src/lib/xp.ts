// XP rules (plan 3.1, PS decisions 2026-11-13). Pure, no React Native or Deno imports: runs in Node tests and, as a copy kept
// identical by scripts/sync-edge-lib.mjs, inside the finalize-drive Edge Function. The server computes XP; the phone only shows it.
// Same XP for every travel mode. Top speed never counts (plan 3.10). The smooth multiplier arrives with 3.5 (x1.0 until then).

export const XP = {
  /** Per km on ground the account had not explored before. */
  perKmNew: 10,
  /** Per km on cells already explored (a repeated road pays half). */
  perKmKnown: 5,
  perNewCell: 25,
  /** First counted drive of the Bangkok day, only for a drive of at least `firstDriveMinM`. */
  firstDrive: 50,
  firstDriveMinM: 1000,
  /** Distance XP per Bangkok calendar day. New-cell XP and the first-drive bonus are never capped. */
  dailyDistanceCap: 1500,
  /** A drive that started longer ago than this still counts (stats, cells) but earns no XP: made-up "days" cannot dodge the cap. */
  maxAgeDays: 60,
  /** Fewer distinct route points than this = no fingerprint (a parked "drive" cannot be called a duplicate of another one). */
  fingerprintMinPoints: 20,
} as const;

const BANGKOK_OFFSET_MS = 7 * 3_600_000; // UTC+7, no daylight saving

/** The calendar day in Bangkok (UTC+7) as YYYY-MM-DD. Daily caps and the first-drive bonus use it. */
export function bangkokDay(ms: number): string {
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export interface DriveXpInput {
  distanceM: number;
  /** Distinct H3 cells the drive touched. */
  totalCells: number;
  /** Of those, cells this account had not explored before. */
  newCells: number;
  /** No other counted drive of this account on the same Bangkok day (and the bonus not taken yet). */
  firstOfDay: boolean;
  /** Distance XP already earned today (Bangkok day). */
  distanceXpToday: number;
  startedAtMs: number;
  nowMs: number;
}

export interface DriveXp {
  distance: number;
  newCells: number;
  firstDrive: number;
  total: number;
  /** The daily distance cap cut this drive's distance XP. */
  capped: boolean;
  /** The drive is older than `maxAgeDays`: no XP at all. */
  tooOld: boolean;
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function computeDriveXp(i: DriveXpInput): DriveXp {
  if (i.startedAtMs < i.nowMs - XP.maxAgeDays * 86_400_000) {
    return { distance: 0, newCells: 0, firstDrive: 0, total: 0, capped: false, tooOld: true };
  }
  const distanceM = nonNeg(i.distanceM);
  const totalCells = Math.floor(nonNeg(i.totalCells));
  const newCells = Math.min(Math.floor(nonNeg(i.newCells)), totalCells);
  const newShare = totalCells > 0 ? newCells / totalCells : 0;
  const raw = Math.round((distanceM / 1000) * (newShare * XP.perKmNew + (1 - newShare) * XP.perKmKnown));
  const left = Math.max(0, XP.dailyDistanceCap - nonNeg(i.distanceXpToday));
  const distance = Math.min(raw, left);
  const newCellXp = newCells * XP.perNewCell;
  const firstDrive = i.firstOfDay && distanceM >= XP.firstDriveMinM ? XP.firstDrive : 0;
  return { distance, newCells: newCellXp, firstDrive, total: distance + newCellXp + firstDrive, capped: raw > left, tooOld: false };
}

/**
 * The text that is hashed (SHA-256, in the Edge Function) to spot the same drive uploaded twice (delete + upload again, or
 * timestamps shifted): route points rounded to 4 decimals (about 11 m), consecutive repeats dropped, no times. Hashing
 * `[lng, lat]` points of the cleaned route. Null when the route is too short to be a fingerprint.
 */
export function fingerprintInput(route: readonly (readonly [number, number])[]): string | null {
  const parts: string[] = [];
  let last = '';
  for (const [lng, lat] of route) {
    const p = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (p === last) continue;
    parts.push(p);
    last = p;
  }
  return parts.length < XP.fingerprintMinPoints ? null : parts.join(';');
}
