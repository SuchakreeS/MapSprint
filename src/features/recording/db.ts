// Local SQLite store for GPS points. Every point is written to disk the moment
// it arrives, so a crash or a killed app never loses a drive.
import * as SQLite from 'expo-sqlite';

import type { GpsPoint } from '@/lib/geo';
import { parseTravelMode, type TravelMode } from '@/lib/travel-mode';
import type { ServerStats, UploadRow, UploadState } from '@/lib/upload-queue';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('mapsprint.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      speed REAL,
      accuracy REAL,
      heading REAL
    );
    CREATE INDEX IF NOT EXISTS idx_points_session_ts ON points (session_id, ts);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pause_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pause_session ON pause_events (session_id, id);
    -- 2.3: one row per drive that goes (or went) to the server. drive_uuid is the drives.id on the server, made once so retries are safe.
    CREATE TABLE IF NOT EXISTS uploads (
      session_id INTEGER PRIMARY KEY,
      drive_uuid TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      stats TEXT
    );
  `);
  // 2.2: which account a drive belongs to (NULL = recorded as a guest). Added to existing installs once.
  const cols = db.getAllSync<{ name: string }>('PRAGMA table_info(sessions)');
  if (!cols.some((c) => c.name === 'owner_id')) db.execSync('ALTER TABLE sessions ADD COLUMN owner_id TEXT');
  // Car picker: which car (public.vehicles id) was driven. NULL = none chosen. Sent with the drive on upload (2.3).
  if (!cols.some((c) => c.name === 'vehicle_id')) db.execSync('ALTER TABLE sessions ADD COLUMN vehicle_id TEXT');
  // Travel mode (car / motorbike / other). Drives recorded before modes existed are car drives. Sent with the drive on upload (2.3).
  if (!cols.some((c) => c.name === 'mode')) db.execSync("ALTER TABLE sessions ADD COLUMN mode TEXT NOT NULL DEFAULT 'car'");
  return db;
}

const ACTIVE_KEY = 'active_session';
const PAUSE_KEY = 'manual_pause_since';
const OWNER_KEY = 'current_owner';
const FINISH_NOTIFIED_KEY = 'finish_notified_at';

/** The signed-in account's user id, or null for a guest / nobody. Set by the auth layer. */
export function getCurrentOwner(): string | null {
  const row = getDb().getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', OWNER_KEY);
  return row ? row.v : null;
}

export function setCurrentOwner(userId: string | null): void {
  const d = getDb();
  if (userId == null) d.runSync('DELETE FROM kv WHERE k = ?', OWNER_KEY);
  else d.runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', OWNER_KEY, userId);
}

/** Guest drives on this phone become the account's (PS rule: the next account to sign up or log in). */
export function claimGuestSessions(userId: string): number {
  const res = getDb().runSync('UPDATE sessions SET owner_id = ? WHERE owner_id IS NULL', userId);
  return res.changes;
}

export function getActiveSessionId(): number | null {
  const row = getDb().getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', ACTIVE_KEY);
  return row ? Number(row.v) : null;
}

export function startSession(now: number, vehicleId: string | null = null, mode: TravelMode = 'car'): number {
  const d = getDb();
  const res = d.runSync(
    'INSERT INTO sessions (started_at, owner_id, vehicle_id, mode) VALUES (?, ?, ?, ?)',
    now,
    getCurrentOwner(),
    vehicleId,
    mode,
  );
  const id = Number(res.lastInsertRowId);
  d.runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ACTIVE_KEY, String(id));
  d.runSync('DELETE FROM kv WHERE k = ?', PAUSE_KEY); // never inherit a stale pause
  d.runSync('DELETE FROM kv WHERE k = ?', FINISH_NOTIFIED_KEY);
  return id;
}

export function endActiveSession(now: number): void {
  const id = getActiveSessionId();
  if (id == null) return;
  const d = getDb();
  d.runSync('UPDATE sessions SET ended_at = ? WHERE id = ?', now, id);
  d.runSync('DELETE FROM kv WHERE k = ?', ACTIVE_KEY);
  d.runSync('DELETE FROM kv WHERE k = ?', PAUSE_KEY);
  d.runSync('DELETE FROM kv WHERE k = ?', FINISH_NOTIFIED_KEY);
}

/** When the driver pressed Pause (ms), or null while not manually paused. The location task reads this. */
export function getManualPauseSince(): number | null {
  const row = getDb().getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', PAUSE_KEY);
  return row ? Number(row.v) : null;
}

export function setManualPauseSince(ts: number | null): void {
  const d = getDb();
  if (ts == null) d.runSync('DELETE FROM kv WHERE k = ?', PAUSE_KEY);
  else d.runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', PAUSE_KEY, String(ts));
}

export interface PauseEventRow {
  id: number;
  ts: number;
  type: 'pause' | 'resume';
}

export function insertPauseEvent(sessionId: number, ts: number, type: 'pause' | 'resume'): void {
  getDb().runSync(
    'INSERT INTO pause_events (session_id, ts, type) VALUES (?, ?, ?)',
    sessionId,
    ts,
    type,
  );
}

/** Pause events of a session with id greater than `afterId`, oldest first. Pass 0 for all. */
export function getPauseEventsSince(sessionId: number, afterId: number): PauseEventRow[] {
  return getDb().getAllSync<PauseEventRow>(
    'SELECT id, ts, type FROM pause_events WHERE session_id = ? AND id > ? ORDER BY id',
    sessionId,
    afterId,
  );
}

export function insertPoints(sessionId: number, points: GpsPoint[]): void {
  if (!points.length) return;
  const d = getDb();
  d.withTransactionSync(() => {
    for (const p of points) {
      d.runSync(
        'INSERT INTO points (session_id, ts, lat, lng, speed, accuracy, heading) VALUES (?, ?, ?, ?, ?, ?, ?)',
        sessionId,
        p.ts,
        p.lat,
        p.lng,
        p.speed,
        p.accuracy,
        p.heading,
      );
    }
  });
}

export function getPoints(sessionId: number): GpsPoint[] {
  return getDb().getAllSync<GpsPoint>(
    'SELECT ts, lat, lng, speed, accuracy, heading FROM points WHERE session_id = ? ORDER BY ts',
    sessionId,
  );
}

/** Points with `ts` after `afterTs` (ms), oldest first. Pass 0 for the whole session. */
export function getPointsSince(sessionId: number, afterTs: number): GpsPoint[] {
  return getDb().getAllSync<GpsPoint>(
    'SELECT ts, lat, lng, speed, accuracy, heading FROM points WHERE session_id = ? AND ts > ? ORDER BY ts',
    sessionId,
    afterTs,
  );
}

export function getSessionStartedAt(sessionId: number): number | null {
  const row = getDb().getFirstSync<{ started_at: number }>(
    'SELECT started_at FROM sessions WHERE id = ?',
    sessionId,
  );
  return row ? row.started_at : null;
}

export interface SessionInfo {
  id: number;
  started_at: number;
  ended_at: number | null;
  owner_id: string | null;
  vehicle_id: string | null;
  mode: TravelMode;
}

export function getSession(sessionId: number): SessionInfo | null {
  const row = getDb().getFirstSync<SessionInfo>(
    'SELECT id, started_at, ended_at, owner_id, vehicle_id, mode FROM sessions WHERE id = ?',
    sessionId,
  );
  return row ? { ...row, mode: parseTravelMode(row.mode) } : null;
}

export interface SessionRow {
  id: number;
  started_at: number;
  ended_at: number | null;
  owner_id: string | null;
  points: number;
}

export function listSessions(limit = 20): SessionRow[] {
  return getDb().getAllSync<SessionRow>(
    `SELECT s.id, s.started_at, s.ended_at, s.owner_id, COUNT(p.id) AS points
     FROM sessions s LEFT JOIN points p ON p.session_id = s.id
     GROUP BY s.id ORDER BY s.id DESC LIMIT ?`,
    limit,
  );
}

/**
 * Timestamp (ms) of the last point that was moving, or null if none yet. Same rule as the live stats engine
 * (src/lib/live-stats.ts): points with accuracy worse than `maxAccuracyM` are ignored, otherwise speed >= the stopped limit.
 * Without the accuracy filter, poor indoor fixes with jittery speed (phone parked at home) kept "moving" fresh forever.
 */
export function getLastMovingTs(sessionId: number, minSpeedMs: number, maxAccuracyM: number): number | null {
  const row = getDb().getFirstSync<{ t: number | null }>(
    'SELECT MAX(ts) AS t FROM points WHERE session_id = ? AND speed >= ? AND accuracy IS NOT NULL AND accuracy <= ?',
    sessionId,
    minSpeedMs,
    maxAccuracyM,
  );
  return row?.t ?? null;
}

/** When the "Finish this drive?" notification was last posted for the active drive (snooze), or null. */
export function getFinishNotifiedAt(): number | null {
  const row = getDb().getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', FINISH_NOTIFIED_KEY);
  return row ? Number(row.v) : null;
}

export function setFinishNotifiedAt(ts: number): void {
  getDb().runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', FINISH_NOTIFIED_KEY, String(ts));
}

// ---- Upload queue (2.3). Pure rules: src/lib/upload-queue.ts. The runner: src/features/sync/upload-runner.ts. ----

export interface UploadRecord extends UploadRow {
  driveUuid: string;
  reason: string | null;
  stats: ServerStats | null;
}

interface UploadDbRow {
  session_id: number;
  drive_uuid: string;
  started_at: number;
  state: UploadState;
  attempts: number;
  next_attempt_at: number;
  reason: string | null;
  stats: string | null;
}

function toRecord(r: UploadDbRow): UploadRecord {
  let stats: ServerStats | null = null;
  try {
    stats = r.stats ? (JSON.parse(r.stats) as ServerStats) : null;
  } catch {
    stats = null;
  }
  return {
    sessionId: r.session_id,
    startedAt: r.started_at,
    state: r.state,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    driveUuid: r.drive_uuid,
    reason: r.reason,
    stats,
  };
}

/** Upload rows of the drives that belong to `owner` (never another account's). */
export function listUploads(owner: string): UploadRecord[] {
  return getDb()
    .getAllSync<UploadDbRow>(
      `SELECT u.* FROM uploads u JOIN sessions s ON s.id = u.session_id WHERE s.owner_id = ? ORDER BY u.started_at`,
      owner,
    )
    .map(toRecord);
}

export function getUpload(sessionId: number): UploadRecord | null {
  const r = getDb().getFirstSync<UploadDbRow>('SELECT * FROM uploads WHERE session_id = ?', sessionId);
  return r ? toRecord(r) : null;
}

/** Add a drive to the queue once (an existing row is left alone, so its uuid and state never change). */
export function addUpload(sessionId: number, startedAt: number, driveUuid: string, state: UploadState = 'queued', reason: string | null = null): void {
  getDb().runSync(
    'INSERT OR IGNORE INTO uploads (session_id, drive_uuid, started_at, state, reason) VALUES (?, ?, ?, ?, ?)',
    sessionId,
    driveUuid,
    startedAt,
    state,
    reason,
  );
}

export function updateUpload(
  sessionId: number,
  patch: { state: UploadState; attempts?: number; nextAttemptAt?: number; reason?: string | null; stats?: ServerStats | null },
): void {
  const cur = getUpload(sessionId);
  if (!cur) return;
  getDb().runSync(
    'UPDATE uploads SET state = ?, attempts = ?, next_attempt_at = ?, reason = ?, stats = ? WHERE session_id = ?',
    patch.state,
    patch.attempts ?? cur.attempts,
    patch.nextAttemptAt ?? cur.nextAttemptAt,
    patch.reason === undefined ? cur.reason : patch.reason,
    patch.stats === undefined ? (cur.stats ? JSON.stringify(cur.stats) : null) : patch.stats ? JSON.stringify(patch.stats) : null,
    sessionId,
  );
}

/** App was closed in the middle of an upload: those drives are simply queued again (every step is safe to repeat). */
export function requeueInterruptedUploads(): void {
  getDb().runSync("UPDATE uploads SET state = 'queued', next_attempt_at = 0 WHERE state = 'uploading'");
}

/** Finished drives of `owner` that are not in the queue yet (new ones, and drives from before uploads existed). */
export function listUnqueuedFinishedSessions(owner: string): { id: number; started_at: number; points: number }[] {
  return getDb().getAllSync<{ id: number; started_at: number; points: number }>(
    `SELECT s.id, s.started_at, COUNT(p.id) AS points
     FROM sessions s LEFT JOIN points p ON p.session_id = s.id
     WHERE s.owner_id = ? AND s.ended_at IS NOT NULL AND s.id NOT IN (SELECT session_id FROM uploads)
     GROUP BY s.id ORDER BY s.started_at`,
    owner,
  );
}

/** Pull-to-refresh: do not wait for the back-off, try the waiting drives now. */
export function makeQueuedUploadsDue(): void {
  getDb().runSync("UPDATE uploads SET next_attempt_at = 0 WHERE state = 'queued'");
}
