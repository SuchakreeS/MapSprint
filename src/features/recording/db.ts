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
  `);
  return db;
}

const ACTIVE_KEY = 'active_session';

export function getActiveSessionId(): number | null {
  const row = getDb().getFirstSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', ACTIVE_KEY);
  return row ? Number(row.v) : null;
}

export function startSession(now: number): number {
  const d = getDb();
  const res = d.runSync('INSERT INTO sessions (started_at) VALUES (?)', now);
  const id = Number(res.lastInsertRowId);
  d.runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', ACTIVE_KEY, String(id));
  return id;
}

export function endActiveSession(now: number): void {
  const id = getActiveSessionId();
  if (id == null) return;
  const d = getDb();
  d.runSync('UPDATE sessions SET ended_at = ? WHERE id = ?', now, id);
  d.runSync('DELETE FROM kv WHERE k = ?', ACTIVE_KEY);
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

export interface SessionRow {
  id: number;
  started_at: number;
  ended_at: number | null;
  points: number;
}

export function listSessions(limit = 20): SessionRow[] {
  return getDb().getAllSync<SessionRow>(
    `SELECT s.id, s.started_at, s.ended_at, COUNT(p.id) AS points
     FROM sessions s LEFT JOIN points p ON p.session_id = s.id
     GROUP BY s.id ORDER BY s.id DESC LIMIT ?`,
    limit,
  );
}
