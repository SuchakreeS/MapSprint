// XP rules (plan 3.1, PS 2026-11-13). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bangkokDay, computeDriveXp, fingerprintInput, XP, type DriveXpInput } from '../src/lib/xp.ts';

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const base: DriveXpInput = {
  distanceM: 10_000,
  totalCells: 40,
  newCells: 0,
  firstOfDay: false,
  distanceXpToday: 0,
  startedAtMs: NOW - 3_600_000,
  nowMs: NOW,
};

test('bangkokDay is the UTC+7 calendar day', () => {
  assert.equal(bangkokDay(Date.UTC(2026, 10, 13, 16, 59, 59)), '2026-11-13'); // 23:59:59 Bangkok
  assert.equal(bangkokDay(Date.UTC(2026, 10, 13, 17, 0, 0)), '2026-11-14'); // midnight Bangkok
  assert.equal(bangkokDay(Date.UTC(2026, 0, 1, 0, 0, 0)), '2026-01-01');
});

test('distance: 10 XP/km on new ground, 5 XP/km on known cells, split by the share of known cells', () => {
  assert.equal(computeDriveXp({ ...base, newCells: 40 }).distance, 100); // 10 km, all new
  assert.equal(computeDriveXp({ ...base, newCells: 0 }).distance, 50); // all known
  assert.equal(computeDriveXp({ ...base, newCells: 20 }).distance, 75); // half and half
  assert.equal(computeDriveXp({ ...base, distanceM: 1234, newCells: 40 }).distance, 12); // rounded
});

test('a drive with no cells counts as known ground (never more than 5 XP/km)', () => {
  assert.equal(computeDriveXp({ ...base, totalCells: 0, newCells: 0 }).distance, 50);
});

test('new cells: 25 XP each, never capped', () => {
  const x = computeDriveXp({ ...base, newCells: 12, distanceXpToday: XP.dailyDistanceCap });
  assert.equal(x.newCells, 300);
  assert.equal(x.distance, 0);
});

test('first drive of the day: +50, only when the drive is at least 1 km', () => {
  assert.equal(computeDriveXp({ ...base, firstOfDay: true }).firstDrive, 50);
  assert.equal(computeDriveXp({ ...base, firstOfDay: false }).firstDrive, 0);
  assert.equal(computeDriveXp({ ...base, firstOfDay: true, distanceM: 999 }).firstDrive, 0);
});

test('daily distance cap: 1,500 XP per Bangkok day; the rest of the drive earns nothing for distance', () => {
  const x = computeDriveXp({ ...base, distanceM: 50_000, newCells: 40, distanceXpToday: 1_200 });
  assert.equal(x.distance, 300);
  assert.equal(x.capped, true);
  const under = computeDriveXp({ ...base, distanceXpToday: 1_000 });
  assert.equal(under.distance, 50);
  assert.equal(under.capped, false);
  const over = computeDriveXp({ ...base, distanceXpToday: 9_999 });
  assert.equal(over.distance, 0);
  assert.equal(over.capped, true);
});

test('total = distance + new cells + first drive', () => {
  const x = computeDriveXp({ ...base, newCells: 20, firstOfDay: true });
  assert.equal(x.total, 75 + 500 + 50);
});

test('a drive that started more than 60 days ago earns nothing', () => {
  const old = computeDriveXp({ ...base, newCells: 40, firstOfDay: true, startedAtMs: NOW - 61 * 86_400_000 });
  assert.deepEqual(old, { distance: 0, newCells: 0, firstDrive: 0, total: 0, capped: false, tooOld: true });
  assert.equal(computeDriveXp({ ...base, startedAtMs: NOW - 59 * 86_400_000 }).tooOld, false);
});

test('bad numbers never produce negative or NaN XP', () => {
  const x = computeDriveXp({ ...base, distanceM: Number.NaN, newCells: -5, totalCells: 3, distanceXpToday: Number.NaN });
  for (const v of [x.distance, x.newCells, x.firstDrive, x.total]) assert.ok(Number.isInteger(v) && v >= 0, String(v));
});

test('fingerprintInput: 4-decimal rounding, repeats dropped, no time; null for tiny tracks', () => {
  const line: [number, number][] = [];
  for (let i = 0; i < 30; i++) line.push([100.5 + i * 0.001, 13.7 + i * 0.001]);
  const fp = fingerprintInput(line);
  assert.ok(fp);
  // GPS jitter below the rounding and doubled points give the same text.
  const jittered = line.flatMap(([lng, lat]) => [
    [lng + 0.00001, lat - 0.00001] as [number, number],
    [lng, lat] as [number, number],
  ]);
  assert.equal(fingerprintInput(jittered), fp);
  assert.notEqual(fingerprintInput(line.slice(1)), fp);
  // A parked "drive" (a few spots) has no fingerprint, so two of them on different days are not called duplicates.
  assert.equal(fingerprintInput(line.slice(0, XP.fingerprintMinPoints - 1)), null);
});

// The database enforces the same cap (supabase/migrations/20261113130000_badges.sql, private.xp_daily_distance_cap): keep them equal.
test('the SQL daily distance cap matches XP.dailyDistanceCap', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../supabase/migrations/20261113130000_badges.sql', import.meta.url), 'utf8');
  const m = /function private\.xp_daily_distance_cap\(\)[\s\S]*?\$\$ select (\d+) \$\$/.exec(sql);
  assert.ok(m, 'cap function not found in the migration');
  assert.equal(Number(m[1]), XP.dailyDistanceCap);
});
