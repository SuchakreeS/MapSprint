// finalize-drive (plan 2.4). Called by the app after it uploaded a drive's raw track (src/features/sync/upload-runner.ts).
// Design: docs/superpowers/specs/2026-11-10-drive-upload-finalize-design.md. All decisions live in ./lib/finalize.ts (pure, tested in
// Node); this file only talks to Supabase. NEVER trust the phone: every number that counts is recomputed here from the raw points.
//
// Contract with the app (parseFinalizeResponse in src/lib/upload-queue.ts):
//   200 { status: 'processed', stats }      counted (also when asked again: idempotent). stats.topKmh (number | null, plan 3.10)
//                                            is the PRIVATE top speed and stats.newCells (number | null, plan 3.3) the explored cells this
//                                            drive added (0 is valid): this answer only ever goes to the drive's owner (JWT-scoped).
//                                            stats.xp { total, distance, newCells, firstDrive, capped, tooOld, badges } (plan 3.1; badges = XP from
//                                            badges unlocked by this drive, already in total), stats.badges (codes of those badges, plan 3.6),
//                                            stats.level
//                                            and stats.totalXp (plan 3.2, the account after this drive): absent for drives counted
//                                            before XP existed.
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
//  - XP (plan 3.1): computed here by lib/xp.ts from server data only; the database adds it in the same transaction as the drive.
//    The same route counted again (fingerprint, SQLSTATE MSDUP) is rejected as 'duplicate'. Known small race: two drives of the
//    same user finalized at the same instant may both read the same "known cells" / "distance XP today" (the app uploads one
//    drive at a time, so this practically never happens); the first-drive bonus itself is race-proof (unique index).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { finalizeTrack, parseZoneCenter, type RejectReason, type Zone } from './lib/finalize.ts';
import { parseTrackPayload, TRACK_LIMITS } from './lib/track-format.ts';
import { computeDriveXp, XP } from './lib/xp.ts';

const TAG = '[finalize-drive]';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Decompressed JSON cap: a 60k-point track is about 3 MB, so this is generous but stops a zip bomb (memory limit 256 MB). */
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const REASONS: readonly string[] = ['overlap', 'times_mismatch', 'unreadable', 'too_long', 'too_few_points', 'invalid', 'duplicate'];

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
  new_cells: number | null;
  /** NULL for drives counted before XP existed (no back-fill). */
  xp_earned: number | null;
}
const DRIVE_COLUMNS =
  'id, status, started_at, ended_at, distance_m, moving_s, elapsed_s, avg_moving_kmh, avg_overall_kmh, new_cells, xp_earned';

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** SHA-256 as lowercase hex (64 chars, the drive_fingerprints check). */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** XP part of the stored answer for an already counted drive, or {} when it was counted before XP existed. */
async function storedXp(drive: DriveRow, uid: string, flags: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (drive.xp_earned == null) return {};
  const [events, profile, unlocked] = await Promise.all([
    admin.from('xp_events').select('source, amount').eq('drive_id', drive.id),
    admin.from('profiles').select('total_xp, level').eq('id', uid).maybeSingle(),
    admin.from('user_badges').select('badges(code)').eq('drive_id', drive.id).eq('user_id', uid),
  ]);
  if (events.error || profile.error || unlocked.error) return null;
  // The embedded badge is one object (PostgREST many-to-one); accept an array too.
  const badgeCodes: string[] = (unlocked.data ?? []).flatMap((row: { badges: unknown }) => {
    const b = Array.isArray(row.badges) ? row.badges : [row.badges];
    return b.map((x) => (x as { code?: unknown } | null)?.code).filter((c): c is string => typeof c === 'string');
  });
  const part = (src: string) => (events.data ?? []).filter((e) => e.source === src).reduce((sum, e) => sum + (e.amount ?? 0), 0);
  return {
    xp: {
      total: drive.xp_earned,
      distance: part('distance'),
      newCells: part('new_cell'),
      firstDrive: part('first_drive'),
      capped: flags.xpCapped === true,
      tooOld: flags.xpTooOld === true,
      badges: part('badge'),
    },
    badges: badgeCodes,
    ...(isNum(profile.data?.level) ? { level: profile.data.level } : {}),
    ...(isNum(profile.data?.total_xp) ? { totalXp: profile.data.total_xp } : {}),
  };
}

/** The stored answer for a drive that is already decided (idempotent retries), or null while it is still 'uploading'. */
async function alreadyDecided(drive: DriveRow, uid: string): Promise<Response | null> {
  if (drive.status === 'processed') {
    const { distance_m, moving_s, elapsed_s, avg_moving_kmh, avg_overall_kmh, new_cells } = drive;
    if (distance_m == null || moving_s == null || elapsed_s == null || avg_moving_kmh == null || avg_overall_kmh == null) {
      console.error(TAG, 'processed drive without stats', drive.id);
      return json(500, { error: 'incomplete' });
    }
    // The private top speed lives in drive_private (owner-only), never on drives. drive.id is the caller's own (checked by the caller).
    const { data: priv, error: privError } = await admin
      .from('drive_private')
      .select('top_kmh, flags')
      .eq('drive_id', drive.id)
      .maybeSingle();
    if (privError) return json(503, { error: 'try_again' });
    const topKmh = typeof priv?.top_kmh === 'number' ? priv.top_kmh : null;
    const flags = (priv?.flags ?? {}) as Record<string, unknown>;
    const xp = await storedXp(drive, uid, flags);
    if (!xp) return json(503, { error: 'try_again' });
    return json(200, {
      status: 'processed',
      stats: {
        distanceM: distance_m,
        movingS: moving_s,
        elapsedS: elapsed_s,
        avgMovingKmh: avg_moving_kmh,
        avgOverallKmh: avg_overall_kmh,
        topKmh,
        newCells: new_cells,
        ...xp,
      },
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
  const decided = await alreadyDecided(drive, uid);
  if (decided) return decided;

  // The track: path built from the verified user id + the validated drive id.
  const path = `${uid}/${drive.id}.json.gz`; // drive.id = the stored (lowercase) id, which is what the upload used
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

  // XP (plan 3.1): what the rules need from the database (cells already explored, today's distance XP, bonus taken), then the
  // pure rules. The new-cell XP itself is computed in SQL from the exact count (p_xp_per_new_cell), so it always matches the tile.
  const { data: ctx, error: ctxError } = await admin.rpc('drive_xp_context', {
    p_user_id: uid,
    p_started_at: startIso,
    p_cells: outcome.cells,
  });
  if (ctxError || !ctx) {
    console.error(TAG, 'could not read the XP context:', ctxError?.code);
    return json(503, { error: 'try_again' });
  }
  const known = Number((ctx as Record<string, unknown>).known_cells);
  const xp = computeDriveXp({
    distanceM: outcome.stats.distanceM,
    totalCells: outcome.cells.length,
    newCells: outcome.cells.length - (Number.isFinite(known) ? known : outcome.cells.length),
    firstOfDay: (ctx as Record<string, unknown>).first_drive_taken === false,
    distanceXpToday: Number((ctx as Record<string, unknown>).distance_xp_today),
    startedAtMs: outcome.startMs,
    nowMs: Date.now(),
  });
  const fingerprint = outcome.fingerprint ? await sha256Hex(outcome.fingerprint) : null;

  // One database call does it all in ONE transaction (migrations 20261112130000 + 20261113120000): compare-and-set 'uploading' ->
  // 'processed', the fingerprint, the owner-only details, the explored cells and the XP. A failure anywhere rolls everything back.
  const { data: saved, error: saveError } = await admin.rpc('finalize_counted_drive', {
    p_drive_id: driveId,
    p_user_id: uid,
    p_started_at: startIso, // the server's times: the exclusion constraint compares these
    p_ended_at: endIso,
    p_distance_m: outcome.stats.distanceM,
    p_moving_s: outcome.stats.movingS,
    p_elapsed_s: outcome.stats.elapsedS,
    p_avg_moving_kmh: outcome.stats.avgMovingKmh,
    p_avg_overall_kmh: outcome.stats.avgOverallKmh,
    p_route: outcome.routeEwkt, // trimmed at privacy zones and simplified, or null
    p_track_path: path,
    p_top_kmh: outcome.topKmh,
    p_raw_points: outcome.rawPoints,
    p_flags: { ...outcome.flags, xpCapped: xp.capped, xpTooOld: xp.tooOld },
    p_cells: outcome.cells, // owner-only: NOT trimmed by privacy zones
    p_fingerprint: fingerprint,
    p_xp_distance: xp.distance,
    p_xp_per_new_cell: xp.tooOld ? 0 : XP.perNewCell,
    p_xp_first_drive: xp.firstDrive,
  });
  if (saveError) {
    if (saveError.code === '23P01') return reject(uid, driveId, path, 'overlap'); // lost a race with another counted drive
    if (saveError.code === 'MSDUP') return reject(uid, driveId, path, 'duplicate'); // this route was already counted before
    console.error(TAG, 'could not save the drive:', saveError.code); // never log cells or coordinates
    return json(503, { error: 'try_again' });
  }
  // NULL = someone else (a retry, or a second tap) decided this drive first: answer with what they stored. 0 is a real answer
  // (a drive over known roads), so test for null strictly, never for "falsy".
  if (saved === null) {
    const { data: again } = await admin.from('drives').select(DRIVE_COLUMNS).eq('id', driveId).eq('user_id', uid).maybeSingle<DriveRow>();
    const stored = again ? await alreadyDecided(again, uid) : null;
    return stored ?? json(503, { error: 'try_again' });
  }
  const r = saved as Record<string, unknown>;
  const newCells = isNum(r.new_cells) ? r.new_cells : null;
  return json(200, {
    status: 'processed',
    stats: {
      ...outcome.stats,
      topKmh: outcome.topKmh,
      newCells,
      xp: {
        total: r.xp_total,
        distance: xp.distance,
        newCells: r.xp_new_cells,
        firstDrive: r.xp_first_drive,
        capped: xp.capped,
        tooOld: xp.tooOld,
        badges: isNum(r.xp_badges) ? r.xp_badges : 0,
      },
      badges: (Array.isArray(r.badges) ? r.badges : []).map((b: { code?: unknown }) => b.code).filter((c: unknown) => typeof c === 'string'),
      ...(isNum(r.level) ? { level: r.level } : {}),
      ...(isNum(r.total_xp) ? { totalXp: r.total_xp } : {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error(TAG, 'unexpected:', e instanceof Error ? e.message : String(e));
    return json(500, { error: 'internal' });
  }
});
