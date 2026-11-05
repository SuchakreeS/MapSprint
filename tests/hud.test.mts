// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONTROL_LOCK_KMH, GAUGE_MAX_KMH, REDLINE_START, controlsLocked, gaugeFraction } from '../src/lib/hud.ts';

test('controls lock above 10 km/h, not at or below it', () => {
  assert.equal(CONTROL_LOCK_KMH, 10);
  assert.equal(controlsLocked(10), false);
  assert.equal(controlsLocked(10.1), true);
  assert.equal(controlsLocked(0), false);
  assert.equal(controlsLocked(120), true);
});

test('unknown speed does not lock the controls', () => {
  assert.equal(controlsLocked(null), false);
});

test('gauge fraction is speed over 160 km/h', () => {
  assert.equal(GAUGE_MAX_KMH, 160);
  assert.equal(gaugeFraction(64), 0.4);
  assert.equal(gaugeFraction(0), 0);
  assert.equal(gaugeFraction(160), 1);
});

test('gauge fraction is clamped and survives bad input', () => {
  assert.equal(gaugeFraction(200), 1);
  assert.equal(gaugeFraction(-1), 0);
  assert.equal(gaugeFraction(null), 0);
  assert.equal(gaugeFraction(NaN), 0);
});

test('redline starts at 85% of the gauge', () => {
  assert.equal(REDLINE_START, 0.85);
});
