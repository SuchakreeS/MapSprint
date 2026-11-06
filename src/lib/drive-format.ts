// Date and title formatting for the drive history and recap. Uses the phone's local time.
// Pure, no React Native imports so it runs in Node tests too.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const two = (n: number) => String(n).padStart(2, '0');
const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** "07:05:09" */
export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/** Auto title from the start time (users can rename drives once there is a server). */
export function driveTitle(startedAt: number): string {
  const h = new Date(startedAt).getHours();
  if (h >= 5 && h < 11) return 'Morning drive';
  if (h >= 11 && h < 17) return 'Afternoon drive';
  if (h >= 17 && h < 21) return 'Evening drive';
  return 'Night drive';
}

/** "Tue 3" */
export function formatDriveDay(ts: number): string {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/** "NOVEMBER 2026" */
export function monthLabel(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

/** Drives shorter than this are test taps, not drives: hidden from the history list. */
export const MIN_LISTED_DRIVE_M = 100;

export function isJunkDrive(distanceM: number): boolean {
  return !(distanceM >= MIN_LISTED_DRIVE_M);
}

function activeClock(s: number): string {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${h > 0 ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(sec).padStart(2, '0')}`;
}

/**
 * "Tue 3 Nov · 07:12 → 07:44 · 32 min". Pass `activeS` (engine active time) to append
 * "· 28:10 active" when stops (auto-pause) made it at least a minute shorter than the wall clock.
 */
export function formatDateTimeRange(startedAt: number, endedAt: number, activeS?: number): string {
  const month = MONTHS[new Date(startedAt).getMonth()].slice(0, 3);
  const span = endedAt - startedAt;
  const length = span < 60_000 ? '<1 min' : `${Math.round(span / 60_000)} min`;
  const showActive = activeS != null && span / 1000 - activeS >= 60;
  const active = showActive ? ` · ${activeClock(activeS)} active` : '';
  return `${formatDriveDay(startedAt)} ${month} · ${hhmm(startedAt)} → ${hhmm(endedAt)} · ${length}${active}`;
}

/** "1 drive" / "2 drives" */
export function formatDriveCount(n: number): string {
  return `${n} ${n === 1 ? 'drive' : 'drives'}`;
}

/** Groups by month in the order given (pass newest first). Same month in another year is separate. */
export function groupByMonth<T extends { startedAt: number }>(
  items: T[],
): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = monthLabel(item.startedAt);
    const list = groups.get(label);
    if (list) list.push(item);
    else groups.set(label, [item]);
  }
  return [...groups].map(([label, list]) => ({ label, items: list }));
}
