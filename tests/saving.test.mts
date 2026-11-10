// What the Saving screen (design 09) shows while a drive uploads. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NO_SIGNAL_AFTER_MS, savingView } from '../src/lib/saving.ts';

const row = (state: 'queued' | 'uploading' | 'counted' | 'rejected', attempts = 0, reason: string | null = null) => ({ state, attempts, reason });

test('percent climbs with the real phases and only reaches 100 when the server counted the drive', () => {
  const p = (r: ReturnType<typeof row> | null, phase: Parameters<typeof savingView>[1], t = 1000) => savingView(r, phase, t).percent;
  assert.ok(p(null, null) > 0 && p(null, null) < 20, 'a first moment of "getting ready"');
  const order = [p(row('uploading'), 'preparing'), p(row('uploading'), 'row'), p(row('uploading'), 'track'), p(row('uploading'), 'server')];
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'never goes backwards');
  assert.ok(order[3] < 100);
  assert.equal(p(row('counted'), null), 100);
});

test('the ring label says uploading until the server is checking, then checking, then done', () => {
  assert.equal(savingView(row('uploading'), 'track', 1000).label, 'uploading');
  assert.equal(savingView(row('uploading'), 'server', 1000).label, 'checking');
  assert.equal(savingView(row('counted'), null, 1000).label, 'done');
});

test('the two real steps (track cleaned, speed and distance) are done only when counted', () => {
  assert.deepEqual(savingView(row('uploading'), 'track', 1000).steps, { cleaned: 'waiting', speed: 'waiting' });
  assert.deepEqual(savingView(row('uploading'), 'server', 1000).steps, { cleaned: 'working', speed: 'waiting' });
  assert.deepEqual(savingView(row('counted'), null, 1000).steps, { cleaned: 'done', speed: 'done' });
});

test('outcome: wait while queued or uploading, counted, rejected', () => {
  assert.equal(savingView(row('queued'), null, 1000).outcome, 'wait');
  assert.equal(savingView(row('uploading'), 'row', 1000).outcome, 'wait');
  assert.equal(savingView(row('counted'), null, 1000).outcome, 'counted');
  assert.equal(savingView(row('rejected', 1, 'overlap'), null, 1000).outcome, 'rejected');
});

test('a drive with nothing to count (tiny test tap) goes straight to the local recap', () => {
  assert.equal(savingView(row('rejected', 0, 'junk'), null, 1000).outcome, 'local');
  assert.equal(savingView(row('rejected', 0, 'too_few_points'), null, 1000).outcome, 'local');
});

test('no signal: after 10 s without being counted the "safe on your phone" note takes over', () => {
  assert.equal(savingView(row('uploading'), 'row', NO_SIGNAL_AFTER_MS - 1).noSignal, false);
  assert.equal(savingView(row('queued', 2), null, NO_SIGNAL_AFTER_MS).noSignal, true);
  assert.equal(savingView(row('uploading'), 'track', NO_SIGNAL_AFTER_MS + 5000).noSignal, true);
  assert.equal(savingView(row('counted'), null, NO_SIGNAL_AFTER_MS + 5000).noSignal, false);
});
