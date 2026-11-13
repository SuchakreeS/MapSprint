// Upload queue rules (design 2026-11-10: waiting, retry, rejected, counted). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  afterFailure,
  backoffMs,
  classifyFailure,
  historyStatus,
  parseFinalizeResponse,
  pickNext,
  rejectReasonText,
  shouldNotifyCounted,
  type UploadRow,
} from '../src/lib/upload-queue.ts';

const row = (sessionId: number, startedAt: number, over: Partial<UploadRow> = {}): UploadRow => ({
  sessionId,
  startedAt,
  state: 'queued',
  attempts: 0,
  nextAttemptAt: 0,
  ...over,
});

test('backoff grows 5 s, 15 s, 45 s, 2 min, 5 min and then stays at 10 min', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 50].map(backoffMs), [5000, 15000, 45000, 120000, 300000, 600000, 600000, 600000]);
});

test('pickNext: oldest drive first, only queued rows that are due', () => {
  const rows = [row(3, 300), row(1, 100, { nextAttemptAt: 9999 }), row(2, 200), row(4, 50, { state: 'counted' })];
  assert.equal(pickNext(rows, 1000)?.sessionId, 2); // 1 is waiting for its back-off, 4 is done
  assert.equal(pickNext(rows, 10_000)?.sessionId, 1); // now 1 is due and oldest
  assert.equal(pickNext([row(1, 1, { state: 'rejected' }), row(2, 2, { state: 'uploading' })], 1000), null);
});

test('classifyFailure: no network, timeouts, server and auth errors are retried; real 4xx are permanent; duplicates are fine', () => {
  assert.equal(classifyFailure(null), 'transient'); // no network
  for (const s of [401, 403, 404, 408, 429, 500, 502, 503, 504]) assert.equal(classifyFailure(s), 'transient', String(s));
  assert.equal(classifyFailure(400), 'permanent');
  assert.equal(classifyFailure(422), 'permanent');
  assert.equal(classifyFailure(409), 'already-done');
  assert.equal(classifyFailure(400, '23505'), 'already-done'); // Postgres unique violation = the row/file already exists
});

test('afterFailure: transient goes back to the queue with a longer wait, permanent is rejected for good', () => {
  const r = row(1, 100, { state: 'uploading', attempts: 1 });
  assert.deepEqual(afterFailure(r, 'transient', 1000), { state: 'queued', attempts: 2, nextAttemptAt: 1000 + 15_000 });
  assert.deepEqual(afterFailure(r, 'permanent', 1000), { state: 'rejected', attempts: 2, nextAttemptAt: 0 });
});

test('parseFinalizeResponse reads the server answer: counted, rejected with a reason, or try again', () => {
  const stats = { distanceM: 9120, movingS: 1759, elapsedS: 2700, avgMovingKmh: 18.7, avgOverallKmh: 12.2 };
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats }), { kind: 'counted', stats });
  assert.deepEqual(parseFinalizeResponse({ status: 'rejected', reason: 'overlap' }), { kind: 'rejected', reason: 'overlap' });
  assert.deepEqual(parseFinalizeResponse({ status: 'rejected' }), { kind: 'rejected', reason: 'invalid' });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { distanceM: 'x' } }), { kind: 'retry' }); // unreadable
  assert.deepEqual(parseFinalizeResponse(null), { kind: 'retry' });
  assert.deepEqual(parseFinalizeResponse({ status: 'uploading' }), { kind: 'retry' });
});

test('parseFinalizeResponse keeps the private top speed when the server sends one, and never refuses an answer over it', () => {
  const stats = { distanceM: 9120, movingS: 1759, elapsedS: 2700, avgMovingKmh: 18.7, avgOverallKmh: 12.2 };
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, topKmh: 97.4 } }), { kind: 'counted', stats: { ...stats, topKmh: 97.4 } });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, topKmh: null } }), { kind: 'counted', stats });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, topKmh: 'fast' } }), { kind: 'counted', stats });
});

test('parseFinalizeResponse keeps newCells (0 included) when the server sends a number, and never refuses an answer over it', () => {
  const stats = { distanceM: 9120, movingS: 1759, elapsedS: 2700, avgMovingKmh: 18.7, avgOverallKmh: 12.2 };
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, newCells: 12 } }), { kind: 'counted', stats: { ...stats, newCells: 12 } });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, newCells: 0 } }), { kind: 'counted', stats: { ...stats, newCells: 0 } });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, newCells: null } }), { kind: 'counted', stats });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, newCells: 'many' } }), { kind: 'counted', stats });
});

test('parseFinalizeResponse keeps XP, level and total XP when the server sends them (plan 3.1), and never refuses an answer over them', () => {
  const stats = { distanceM: 9120, movingS: 1759, elapsedS: 2700, avgMovingKmh: 18.7, avgOverallKmh: 12.2 };
  const xp = { total: 175, distance: 75, newCells: 50, firstDrive: 50, capped: false, tooOld: false };
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, xp, level: 3, totalXp: 400 } }), {
    kind: 'counted',
    stats: { ...stats, xp, level: 3, totalXp: 400 },
  });
  // A broken xp object is dropped, the rest of the answer still counts.
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, xp: { total: 'lots' }, level: 'x', totalXp: null } }), { kind: 'counted', stats });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, xp: { ...xp, capped: 'yes' } } }), { kind: 'counted', stats });
});

test('rejectReasonText knows the duplicate reason', () => {
  assert.equal(rejectReasonText('duplicate'), 'This drive was already counted.');
});

test('shouldNotifyCounted: only when the driver was not just waiting on the Saving screen', () => {
  assert.equal(shouldNotifyCounted(1_000_000, 1_000_000 + 30_000), false); // counted within seconds of Finish
  assert.equal(shouldNotifyCounted(1_000_000, 1_000_000 + 10 * 60_000), true); // had to wait for signal
});

test('historyStatus: what each History row says about its upload', () => {
  assert.equal(historyStatus(undefined)?.label, 'Waiting to upload'); // signed-in drive not queued yet
  assert.equal(historyStatus(row(1, 1))?.label, 'Waiting to upload');
  assert.equal(historyStatus(row(1, 1, { state: 'uploading' }))?.label, 'Uploading…');
  assert.equal(historyStatus(row(1, 1, { state: 'counted' }))?.label, 'Counted');
  assert.equal(historyStatus(row(1, 1, { state: 'rejected' }))?.label, "Couldn't count");
});

test('rejectReasonText turns server reasons into short sentences, unknown reasons stay vague', () => {
  assert.match(rejectReasonText('overlap'), /overlaps another drive/i);
  assert.match(rejectReasonText('too_long'), /too long/i);
  assert.match(rejectReasonText('something-new'), /couldn't be checked|could not be checked/i);
});

test('parseFinalizeResponse keeps badge XP and the unlocked badge codes (plan 3.6), drops anything malformed, never refuses the answer', () => {
  const stats = { distanceM: 9120, movingS: 1759, elapsedS: 2700, avgMovingKmh: 18.7, avgOverallKmh: 12.2 };
  const xp = { total: 275, distance: 75, newCells: 50, firstDrive: 50, capped: false, tooOld: false };
  const got = parseFinalizeResponse({ status: 'processed', stats: { ...stats, xp: { ...xp, badges: 100 }, badges: ['first_gear', 'century'] } });
  assert.deepEqual(got, { kind: 'counted', stats: { ...stats, xp: { ...xp, badges: 100 }, badges: ['first_gear', 'century'] } });
  // No badges key (older server): the XP is kept without it.
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, xp } }), { kind: 'counted', stats: { ...stats, xp } });
  // Bad values are dropped.
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, xp: { ...xp, badges: 'lots' }, badges: ['ok', 5, null] } }),
    { kind: 'counted', stats: { ...stats, xp, badges: ['ok'] } });
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, badges: 'first_gear' } }), { kind: 'counted', stats });
  // An empty list is a real answer (no badge this drive).
  assert.deepEqual(parseFinalizeResponse({ status: 'processed', stats: { ...stats, badges: [] } }), { kind: 'counted', stats: { ...stats, badges: [] } });
});
