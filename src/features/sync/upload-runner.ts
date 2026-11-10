// Uploads finished drives of the signed-in user (2.3). Pure rules live in src/lib/upload-queue.ts and track-format.ts.
// Per drive, every step is safe to repeat (so a killed app or a lost connection just means "try again later"):
//   1. insert the `drives` row (id made once on the phone; "already exists" = done)
//   2. upload the gzipped raw track to the private `tracks` bucket ("already exists" = done)
//   3. call the `finalize-drive` Edge Function (2.4): it recomputes everything and answers counted / rejected.
// Only runs while the app is open. A drive is never deleted from the phone, whatever happens here.
import * as Crypto from 'expo-crypto';
import { gzipSync, strToU8 } from 'fflate';

import { getAutoPauseMs, readCachedCars } from '@/features/settings/prefs';
import { loadDrive } from '@/features/recording/drive-history';
import {
  addUpload,
  getCurrentOwner,
  getPauseEventsSince,
  getPoints,
  getSession,
  listUnqueuedFinishedSessions,
  listUploads,
  makeQueuedUploadsDue,
  requeueInterruptedUploads,
  updateUpload,
  type UploadRecord,
} from '@/features/recording/db';
import { supabase } from '@/features/sync/supabase';
import { isJunkDrive } from '@/lib/drive-format';
import type { UploadPhase } from '@/lib/saving';
import { buildTrackPayload, TRACK_LIMITS, trackLimitProblem } from '@/lib/track-format';
import {
  afterFailure,
  classifyFailure,
  parseFinalizeResponse,
  pickNext,
  shouldNotifyCounted,
  type FailureClass,
} from '@/lib/upload-queue';
import { vehicleIdForDrive } from '@/lib/travel-mode';

import { notifyDriveCounted } from './counted-notification';

const TAG = '[upload]';

/** Where the drive being uploaded is right now (in memory only): the Saving screen reads it to move its ring. */
const phases = new Map<number, UploadPhase>();
export const getUploadPhase = (sessionId: number): UploadPhase | null => phases.get(sessionId) ?? null;
const FINALIZE_FUNCTION = 'finalize-drive';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Turn a supabase-js error into "retry / give up / already done". */
function classify(status: number | null | undefined, code?: string | null): FailureClass {
  return classifyFailure(status ?? null, code ?? null);
}

/** Drives that were finished but never queued: queue them (junk and one-point taps are marked, not uploaded). */
function discover(owner: string): void {
  for (const s of listUnqueuedFinishedSessions(owner)) {
    const uuid = Crypto.randomUUID();
    if (s.points < 2) {
      addUpload(s.id, s.started_at, uuid, 'rejected', 'too_few_points');
      continue;
    }
    const drive = loadDrive(s.id);
    if (!drive || isJunkDrive(drive.summary.distanceM)) {
      addUpload(s.id, s.started_at, uuid, 'rejected', 'junk'); // hidden from History as well: never uploaded
      continue;
    }
    addUpload(s.id, s.started_at, uuid, 'queued');
  }
}

async function uploadOne(row: UploadRecord, owner: string): Promise<'next' | 'stop'> {
  const fail = (cls: 'transient' | 'permanent', reason?: string): 'next' | 'stop' => {
    const next = afterFailure(row, cls, Date.now());
    updateUpload(row.sessionId, { ...next, reason: cls === 'permanent' ? (reason ?? 'invalid') : null });
    // No network / server trouble: stop here, the later drives would fail the same way. A rejected drive does not block the rest.
    return cls === 'transient' ? 'stop' : 'next';
  };

  const session = getSession(row.sessionId);
  if (!session || session.ended_at == null) return fail('permanent', 'invalid');
  const points = getPoints(row.sessionId);
  if (points.length < 2) return fail('permanent', 'too_few_points');

  // Row times = first / last point, so they always match the track (the server rejects a mismatch of more than 2 min).
  const startedAt = points[0].ts;
  const endedAt = Math.max(points[points.length - 1].ts, startedAt + 1000);
  const pauses = getPauseEventsSince(row.sessionId, 0).map(({ ts, type }) => ({ ts, type }));
  const input = { startedAt, endedAt, mode: session.mode, autoPauseMs: getAutoPauseMs(), points, pauses };

  if (trackLimitProblem(input)) return fail('permanent', 'too_long');
  const gz = gzipSync(strToU8(JSON.stringify(buildTrackPayload(input))));
  if (gz.length > TRACK_LIMITS.maxBytes) return fail('permanent', 'too_long');

  updateUpload(row.sessionId, { state: 'uploading' });
  phases.set(row.sessionId, 'preparing');

  // 1. The drive row. A vehicle that was deleted on the server (or no longer fits the mode) must not block the drive.
  const vehicleId = vehicleIdForDrive(readCachedCars(owner), session.mode, session.vehicle_id);
  const insertRow = (vehicle: string | null) =>
    supabase.from('drives').insert({
      id: row.driveUuid,
      vehicle_id: vehicle,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      mode: session.mode,
    });
  phases.set(row.sessionId, 'row');
  let ins = await insertRow(vehicleId);
  if (ins.error && vehicleId && (ins.error.code === '42501' || ins.error.code === '23503')) {
    console.warn(TAG, `vehicle refused for drive ${row.sessionId}, uploading without it`);
    ins = await insertRow(null);
  }
  if (ins.error) {
    const cls = classify(ins.status, ins.error.code);
    if (cls !== 'already-done') {
      console.warn(TAG, 'drive row failed:', ins.error.code, ins.error.message);
      return fail(cls, 'invalid');
    }
  }

  // 2. The track file. If the row already existed, an earlier try may have got further: when the server has already decided the drive
  // (its answer was lost on the way back), Storage would refuse a second upload (policy: only 'uploading' drives), so skip it and
  // ask finalize-drive, which is idempotent and returns the stored answer.
  let skipUpload = false;
  if (ins.error) {
    const cur = await supabase.from('drives').select('status').eq('id', row.driveUuid).maybeSingle();
    if (cur.error) return fail('transient');
    skipUpload = cur.data != null && cur.data.status !== 'uploading';
  }
  if (!skipUpload) {
    phases.set(row.sessionId, 'track');
    const up = await supabase.storage
      .from('tracks')
      .upload(`${owner}/${row.driveUuid}.json.gz`, gz, { contentType: 'application/gzip', upsert: false });
    if (up.error) {
      const e = up.error as { status?: number; statusCode?: string; code?: string };
      const status = typeof e.status === 'number' ? e.status : null;
      // Older Storage versions answer HTTP 400 with the real code only in the body: read that too.
      const duplicate = e.statusCode === '409' || e.code === 'ResourceAlreadyExists';
      const cls = duplicate ? 'already-done' : classify(status);
      if (cls !== 'already-done') {
        console.warn(TAG, 'track upload failed:', status, up.error.message);
        return fail(cls, 'invalid');
      }
    }
  }

  // 3. The server checks and counts it.
  phases.set(row.sessionId, 'server');
  const res = await supabase.functions.invoke(FINALIZE_FUNCTION, { body: { driveId: row.driveUuid } });
  if (res.error) {
    const ctx = (res.error as { context?: unknown }).context;
    const status = ctx instanceof Response ? ctx.status : null;
    console.warn(TAG, 'finalize failed:', status, res.error.message);
    const cls = classify(status);
    return fail(cls === 'already-done' ? 'transient' : cls, 'invalid');
  }
  const result = parseFinalizeResponse(res.data);
  if (result.kind === 'retry') return fail('transient');
  if (result.kind === 'rejected') {
    updateUpload(row.sessionId, { state: 'rejected', reason: result.reason });
    return 'next';
  }
  updateUpload(row.sessionId, { state: 'counted', reason: null, stats: result.stats });
  if (shouldNotifyCounted(session.ended_at, Date.now())) {
    void notifyDriveCounted(row.sessionId, result.stats.distanceM);
  }
  return 'next';
}

let running = false;
let interruptedHandled = false;

/** Upload everything that is due, oldest first. Safe to call often: only one run at a time, nothing when signed out. */
export async function runUploadQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const owner = getCurrentOwner();
    if (!owner) return; // guests: their drives go up after they sign in (they move to that account first)
    if (!interruptedHandled) {
      requeueInterruptedUploads();
      interruptedHandled = true;
    }
    discover(owner);
    for (;;) {
      const next = pickNext(listUploads(owner), Date.now());
      if (!next) break;
      let result: 'next' | 'stop';
      try {
        result = await uploadOne(next, owner);
      } finally {
        phases.delete(next.sessionId);
      }
      if (result === 'stop') break;
    }
  } catch (e) {
    // Never let the queue crash the app: the drive stays on the phone and the next run tries again.
    console.error(TAG, 'queue run failed:', errText(e));
  } finally {
    running = false;
  }
}

/** Pull-to-refresh in History: skip the back-off and try the waiting drives now. */
export async function retryUploadsNow(): Promise<void> {
  makeQueuedUploadsDue();
  await runUploadQueue();
}

/** True when something is waiting for its turn (queued or uploading): the trigger keeps polling while this is true. */
export function hasPendingUploads(): boolean {
  const owner = getCurrentOwner();
  if (!owner) return false;
  return listUploads(owner).some((r) => r.state === 'queued' || r.state === 'uploading');
}
