// Local SQLite store for GPS points. Every point is written to disk the moment
// it arrives, so a crash or a killed app never loses a drive.
import * as SQLite from 'expo-sqlite';

import type { GpsPoint } from '@/lib/geo';

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
  `);
  // 2.2: which account a drive belongs to (NULL = recorded as a guest). Added to existing installs once.
  const cols = db.getAllSync<{ name: string }>('PRAGMA table_info(sessions)');
  if (!cols.some((c) => c.name === 'owner_id')) db.execSync('ALTER TABLE sessions ADD COLUMN owner_id TEXT');
  return db;
}

const ACTIVE_KEY = 'active_session';
const PAUSE_KEY = 'manual_pause_since';
const OWNER_KEY = 'current_owner';

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

export function startSession(now: number): number {
  const d = getDb();
  const res = d.runSync('INSERT INTO sessions (started_at, owner_id) VALUES (?, ?)', now, getCurrentOwner());
  const id = Number(res.lastInsertRowId);
  d.runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ACTIVE_KEY, String(id));
  d.runSync('DELETE FROM kv WHERE k = ?', PAUSE_KEY); // never inherit a stale pause
  return id;
}

export function endActiveSession(now: number): void {
  const id = getActiveSessionId();
  if (id == null) return;
  const d = getDb();
  d.runSync('UPDATE sessions SET ended_at = ? WHERE id = ?', now, id);
  d.runSync('DELETE FROM kv WHERE k = ?', ACTIVE_KEY);
  d.runSync('DELETE FROM kv WHERE k = ?', PAUSE_KEY);
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
}

export function getSession(sessionId: number): SessionInfo | null {
  return getDb().getFirstSync<SessionInfo>(
    'SELECT id, started_at, ended_at, owner_id FROM sessions WHERE id = ?',
    sessionId,
  );
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
