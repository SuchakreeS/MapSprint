// finalize-drive (plan 2.4). Called by the app after it uploaded a drive's raw track (src/features/sync/upload-runner.ts).
// Design: docs/superpowers/specs/2026-11-10-drive-upload-finalize-design.md. All decisions live in ./lib/finalize.ts (pure, tested in
// Node); this file only talks to Supabase. NEVER trust the phone: every number that counts is recomputed here from the raw points.
//
// Contract with the app (parseFinalizeResponse in src/lib/upload-queue.ts):
//   200 { status: 'processed', stats }      counted (also when asked again: idempotent)
//   200 { status: 'rejected', reason }      final, the drive will never count
//   non-2xx                                  transient (the app retries with back-off): 401 auth, 404 drive row missing,
//                                            500/503 anything that may work later. 400 = malformed request (final).
//
// Security notes (an Opus review checks these):
//  - The caller is identified from their JWT (admin.auth.getUser); every read/write is scoped to that user id.
//  - The track path is built here from the user id + a validated uuid, never taken from the request.
//  - The secret key bypasses RLS: it is only read from the function's environment and never returned or logged.
//  - Privacy zones are read here; if they cannot be read or parsed the function FAILS (never publishes an untrimmed route).
//  - Exactly one winner per drive: compare-and-set on status = 'uploading', plus the DB exclusion constraint on overlapping
//    counted drives (migration 20261110120000).
//  - Decompression is capped (zip bomb), point count and duration are limited before any heavy work.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { finalizeTrack, parseZoneCenter, type RejectReason, type Zone } from './lib/finalize.ts';
import { parseTrackPayload, TRACK_LIMITS } from './lib/track-format.ts';

const TAG = '[finalize-drive]';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Decompressed JSON cap: a 60k-point track is about 3 MB, so this is generous but stops a zip bomb. */
const MAX_JSON_BYTES = 24 * 1024 * 1024;
const REASONS: readonly string[] = ['overlap', 'times_mismatch', 'unreadable', 'too_long', 'too_few_points', 'invalid'];

function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS'); // new style: JSON { "default": "sb_secret_..." }
  if (keys) {
    try {
      const k = (JSON.parse(keys) as Record<string, unknown>).default;
      if (typeof k === 'string' && k) return k;
    } catch {
      // fall through to the legacy key
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface DriveRow {
  id: string;
  status: string;
  started_at: string;
  ended_at: string;
  distance_m: number | null;
  moving_s: number | null;
  elapsed_s: number | null;
  avg_moving_kmh: number | null;
  avg_overall_kmh: number | null;
}
const DRIVE_COLUMNS = 'id, status, started_at, ended_at, distance_m, moving_s, elapsed_s, avg_moving_kmh, avg_overall_kmh';

/** The stored answer for a drive that is already decided (idempotent retries), or null while it is still 'uploading'. */
async function alreadyDecided(drive: DriveRow): Promise<Response | null> {
  if (drive.status === 'processed') {
    const { distance_m, moving_s, elapsed_s, avg_moving_kmh, avg_overall_kmh } = drive;
    if (distance_m == null || moving_s == null || elapsed_s == null || avg_moving_kmh == null || avg_overall_kmh == null) {
      console.error(TAG, 'processed drive without stats', drive.id);
      return json(500, { error: 'incomplete' });
    }
    return json(200, {
      status: 'processed',
      stats: { distanceM: distance_m, movingS: moving_s, elapsedS: elapsed_s, avgMovingKmh: avg_moving_kmh, avgOverallKmh: avg_overall_kmh },
    });
  }
  if (drive.status === 'rejected') {
    const { data } = await admin.from('drive_private').select('flags').eq('drive_id', drive.id).maybeSingle();
    const reason = (data?.flags as { reason?: unknown } | null | undefined)?.reason;
    return json(200, { status: 'rejected', reason: typeof reason === 'string' && REASONS.includes(reason) ? reason : 'invalid' });
  }
  return null;
}

/** Decompress with a size cap. null = not a valid gzip, or it would grow beyond the cap. */
async function gunzipCapped(data: Uint8Array, cap: number): Promise<Uint8Array | null> {
  try {
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.length;
    }
    return out;
  } catch {
    return null;
  }
}

async function reject(uid: string, driveId: string, path: string, reason: RejectReason): Promise<Response> {
  const priv = await admin
    .from('drive_private')
    .upsert({ drive_id: driveId, user_id: uid, track_path: path, flags: { reason } }, { onConflict: 'drive_id' });
  if (priv.error) {
    console.error(TAG, 'could not store the rejection:', priv.error.code);
    return json(503, { error: 'try_again' });
  }
  const upd = await admin.from('drives').update({ status: 'rejected' }).eq('id', driveId).eq('user_id', uid).eq('status', 'uploading');
  if (upd.error) {
    console.error(TAG, 'could not mark the drive rejected:', upd.error.code);
    return json(503, { error: 'try_again' });
  }
  return json(200, { status: 'rejected', reason });
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // Who is calling: verified by the Auth server, not just decoded.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'unauthorized' });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !auth.user) return json(401, { error: 'unauthorized' });
  const uid = auth.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_request' });
  }
  const driveId = (body as { driveId?: unknown } | null)?.driveId;
  if (typeof driveId !== 'string' || !UUID.test(driveId)) return json(400, { error: 'bad_request' });

  // The drive row: only the caller's own.
  const { data: drive, error: driveError } = await admin
    .from('drives')
    .select(DRIVE_COLUMNS)
    .eq('id', driveId)
    .eq('user_id', uid)
    .maybeSingle<DriveRow>();
  if (driveError) return json(503, { error: 'try_again' });
  if (!drive) return json(404, { error: 'drive_not_found' });
  const decided = await alreadyDecided(drive);
  if (decided) return decided;

  // The track: path built from the verified user id + the validated drive id.
  const path = `${uid}/${driveId}.json.gz`;
  const dl = await admin.storage.from('tracks').download(path);
  if (dl.error || !dl.data) return json(503, { error: 'track_unavailable' }); // maybe not uploaded yet: the app retries
  const gz = new Uint8Array(await dl.data.arrayBuffer());
  if (gz.length > TRACK_LIMITS.maxBytes) return reject(uid, driveId, path, 'too_long');
  const raw = await gunzipCapped(gz, MAX_JSON_BYTES);
  if (!raw) return reject(uid, driveId, path, 'unreadable');
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return reject(uid, driveId, path, 'unreadable');
  }
  const payload = parseTrackPayload(parsedJson);
  if (!payload) return reject(uid, driveId, path, 'unreadable');

  // Privacy zones: fail closed. An unreadable zone must never mean "publish the untrimmed route".
  const { data: zoneRows, error: zoneError } = await admin.from('privacy_zones').select('center, radius_m').eq('user_id', uid);
  if (zoneError || !zoneRows) return json(503, { error: 'try_again' });
  const zones: Zone[] = [];
  for (const z of zoneRows) {
    const c = parseZoneCenter(z.center);
    if (!c || typeof z.radius_m !== 'number') {
      console.error(TAG, 'a privacy zone could not be read; refusing to publish a route');
      return json(500, { error: 'zone_unreadable' });
    }
    zones.push({ lat: c.lat, lng: c.lng, radiusM: z.radius_m });
  }

  const outcome = finalizeTrack(payload, { startedAtMs: Date.parse(drive.started_at), endedAtMs: Date.parse(drive.ended_at) }, zones);
  if (outcome.kind === 'rejected') return reject(uid, driveId, path, outcome.reason);

  // Friendly overlap check (the DB exclusion constraint below is what makes it race-proof).
  const startIso = new Date(outcome.startMs).toISOString();
  const endIso = new Date(outcome.endMs).toISOString();
  const { data: clash, error: clashError } = await admin
    .from('drives')
    .select('id')
    .eq('user_id', uid)
    .eq('status', 'processed')
    .neq('id', driveId)
    .lt('started_at', endIso)
    .gt('ended_at', startIso)
    .limit(1);
  if (clashError) return json(503, { error: 'try_again' });
  if (clash && clash.length > 0) return reject(uid, driveId, path, 'overlap');

  // Owner-only details first (idempotent), then the public card with a compare-and-set: only one caller can win.
  const priv = await admin.from('drive_private').upsert(
    { drive_id: driveId, user_id: uid, track_path: path, max_kmh: outcome.maxKmh, raw_points: outcome.rawPoints, flags: outcome.flags },
    { onConflict: 'drive_id' },
  );
  if (priv.error) {
    console.error(TAG, 'could not store drive_private:', priv.error.code);
    return json(503, { error: 'try_again' });
  }
  const upd = await admin
    .from('drives')
    .update({
      status: 'processed',
      started_at: startIso, // the server's times: the exclusion constraint compares these
      ended_at: endIso,
      distance_m: outcome.stats.distanceM,
      moving_s: outcome.stats.movingS,
      elapsed_s: outcome.stats.elapsedS,
      avg_moving_kmh: outcome.stats.avgMovingKmh,
      avg_overall_kmh: outcome.stats.avgOverallKmh,
      route: outcome.routeEwkt, // trimmed at privacy zones and simplified, or null
    })
    .eq('id', driveId)
    .eq('user_id', uid)
    .eq('status', 'uploading')
    .select('id');
  if (upd.error) {
    if (upd.error.code === '23P01') return reject(uid, driveId, path, 'overlap'); // lost a race with another counted drive
    console.error(TAG, 'could not save the drive:', upd.error.code);
    return json(503, { error: 'try_again' });
  }
  if (!upd.data || upd.data.length === 0) {
    // Someone else (a retry, or a second tap) decided this drive first: answer with what they stored.
    const { data: again } = await admin.from('drives').select(DRIVE_COLUMNS).eq('id', driveId).eq('user_id', uid).maybeSingle<DriveRow>();
    const stored = again ? await alreadyDecided(again) : null;
    return stored ?? json(503, { error: 'try_again' });
  }
  return json(200, { status: 'processed', stats: outcome.stats });
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error(TAG, 'unexpected:', e instanceof Error ? e.message : String(e));
    return json(500, { error: 'internal' });
  }
});
