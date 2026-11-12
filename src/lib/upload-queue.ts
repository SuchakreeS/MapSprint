// Upload queue rules (design 2026-11-10): a finished drive of a signed-in user waits, uploads, gets counted or rejected.
// Pure, no React Native imports so it runs in Node tests too. The runner (features/sync) does the network work.

export type UploadState = 'queued' | 'uploading' | 'counted' | 'rejected';

export interface UploadRow {
  /** Local sessions.id. */
  sessionId: number;
  /** Drive start (ms): the queue goes oldest first. */
  startedAt: number;
  state: UploadState;
  /** Failed tries so far. */
  attempts: number;
  /** Not before this time (ms). */
  nextAttemptAt: number;
}

/** Wait after the 1st, 2nd, ... failure. Stays at the last value. */
const BACKOFF_STEPS_MS = [5_000, 15_000, 45_000, 120_000, 300_000, 600_000];

export function backoffMs(attempts: number): number {
  return BACKOFF_STEPS_MS[Math.min(Math.max(attempts, 1), BACKOFF_STEPS_MS.length) - 1];
}

/** The next drive to upload: queued, due, oldest first. One at a time. */
export function pickNext<T extends UploadRow>(rows: T[], now: number): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (r.state !== 'queued' || r.nextAttemptAt > now) continue;
    if (best == null || r.startedAt < best.startedAt) best = r;
  }
  return best;
}

export type FailureClass = 'transient' | 'permanent' | 'already-done';

/**
 * How to treat a failed call. `status` is the HTTP status (null = no network / timeout), `code` an optional Postgres code.
 * Transient: try again later (no network, timeouts, server trouble, an expired login that will refresh, function not deployed yet).
 * Already done: the row or file exists from an earlier try (retries are idempotent).
 */
export function classifyFailure(status: number | null, code?: string | null): FailureClass {
  if (code === '23505' || status === 409) return 'already-done';
  if (status == null) return 'transient';
  if ([401, 403, 404, 408, 429].includes(status) || status >= 500) return 'transient';
  return 'permanent';
}

/** New queue values after a failed try. A permanent failure is final: History shows "Couldn't count". */
export function afterFailure(
  row: UploadRow,
  cls: Exclude<FailureClass, 'already-done'>,
  now: number,
): { state: UploadState; attempts: number; nextAttemptAt: number } {
  const attempts = row.attempts + 1;
  if (cls === 'permanent') return { state: 'rejected', attempts, nextAttemptAt: 0 };
  return { state: 'queued', attempts, nextAttemptAt: now + backoffMs(attempts) };
}

/** The numbers the server worked out for a counted drive (finalize-drive, 2.4). */
export interface ServerStats {
  distanceM: number;
  movingS: number;
  elapsedS: number;
  avgMovingKmh: number;
  avgOverallKmh: number;
  /** Private top speed (plan 3.10). Only for the owner's recap and History; absent from older servers / old drives. */
  topKmh?: number | null;
  /** Explored cells this drive added (plan 3.3). 0 is a real answer. Absent from older servers / drives counted before 3.3. */
  newCells?: number | null;
}

export type FinalizeResult =
  | { kind: 'counted'; stats: ServerStats }
  | { kind: 'rejected'; reason: string }
  | { kind: 'retry' };

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Reads the finalize-drive answer. Anything unreadable means "try again later", never "counted". */
export function parseFinalizeResponse(body: unknown): FinalizeResult {
  if (typeof body !== 'object' || body === null) return { kind: 'retry' };
  const o = body as Record<string, unknown>;
  if (o.status === 'rejected') return { kind: 'rejected', reason: typeof o.reason === 'string' ? o.reason : 'invalid' };
  if (o.status !== 'processed') return { kind: 'retry' };
  const s = o.stats as Record<string, unknown> | undefined;
  if (!s || !isNum(s.distanceM) || !isNum(s.movingS) || !isNum(s.elapsedS) || !isNum(s.avgMovingKmh) || !isNum(s.avgOverallKmh)) {
    return { kind: 'retry' };
  }
  return {
    kind: 'counted',
    stats: {
      distanceM: s.distanceM,
      movingS: s.movingS,
      elapsedS: s.elapsedS,
      avgMovingKmh: s.avgMovingKmh,
      avgOverallKmh: s.avgOverallKmh,
      // Optional extra field: never a reason to refuse an answer (older servers do not send it).
      ...(isNum(s.topKmh) ? { topKmh: s.topKmh } : {}),
      ...(isNum(s.newCells) ? { newCells: s.newCells } : {}),
    },
  };
}

/** A "your drive is counted" notification is for drives that had to wait; if it counted within a minute you were watching. */
export function shouldNotifyCounted(endedAt: number, now: number): boolean {
  return now - endedAt > 2 * 60_000;
}

export interface HistoryStatus {
  label: string;
  tone: 'muted' | 'good' | 'bad';
}

/** What a signed-in drive's History row says. No queue row yet means it is about to be queued: still waiting. */
export function historyStatus(row: UploadRow | undefined): HistoryStatus | null {
  if (!row || row.state === 'queued') return { label: 'Waiting to upload', tone: 'muted' };
  if (row.state === 'uploading') return { label: 'Uploading…', tone: 'muted' };
  if (row.state === 'counted') return { label: 'Counted', tone: 'good' };
  return { label: "Couldn't count", tone: 'bad' };
}

const REJECT_TEXT: Record<string, string> = {
  overlap: 'It overlaps another drive you already have counted.',
  times_mismatch: "The drive's start and end times don't match its track.",
  unreadable: 'The track file could not be read.',
  too_long: 'This drive is too long to count.',
  too_few_points: 'There were too few good GPS points.',
  invalid: 'The track did not pass the checks.',
};

export function rejectReasonText(reason: string | null | undefined): string {
  return (reason && REJECT_TEXT[reason]) || "This drive couldn't be checked.";
}
