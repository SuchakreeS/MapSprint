// Display formatting for the UI (metric only). Pure, no React Native imports.

const isUsable = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Whole km/h, or "--" when the GPS speed is unknown (null, -1, NaN). */
export function formatSpeedKmh(kmh: number | null | undefined): string {
  return isUsable(kmh) ? String(Math.round(kmh)) : '--';
}

/** Metres to km with 2 decimals. Bad input shows as 0.00. */
export function formatDistanceKm(meters: number): string {
  return ((isUsable(meters) ? meters : 0) / 1000).toFixed(2);
}

/** M:SS under an hour, H:MM:SS from one hour. Bad input shows as 0:00. */
export function formatDuration(seconds: number): string {
  const total = isUsable(seconds) ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
