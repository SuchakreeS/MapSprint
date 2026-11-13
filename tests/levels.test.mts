// Levels (plan 3.2): going from level L to L+1 costs round(100 * L^1.5) XP. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { levelForXp, levelProgress, levelUp, litSegments, xpToNext } from '../src/lib/levels.ts';

test('xpToNext = round(100 * L^1.5)', () => {
  assert.equal(xpToNext(1), 100);
  assert.equal(xpToNext(2), 283);
  assert.equal(xpToNext(3), 520);
  assert.equal(xpToNext(4), 800);
});

// These checkpoints are also asserted in pgTAP (private.level_for_xp), so the phone and the server cannot drift apart.
test('level checkpoints: 0 -> 1, 100 -> 2, 383 -> 3, 903 -> 4', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(382), 2);
  assert.equal(levelForXp(383), 3);
  assert.equal(levelForXp(902), 3);
  assert.equal(levelForXp(903), 4);
});

test('bad input is level 1', () => {
  assert.equal(levelForXp(-5), 1);
  assert.equal(levelForXp(Number.NaN), 1);
});

test('levelProgress: level, XP into the level, XP needed, fraction', () => {
  assert.deepEqual(levelProgress(0), { level: 1, intoLevel: 0, needed: 100, fraction: 0 });
  assert.deepEqual(levelProgress(50), { level: 1, intoLevel: 50, needed: 100, fraction: 0.5 });
  const p = levelProgress(383 + 260);
  assert.equal(p.level, 3);
  assert.equal(p.intoLevel, 260);
  assert.equal(p.needed, 520);
  assert.equal(p.fraction, 0.5);
});

test('levels keep going for big totals', () => {
  assert.ok(levelForXp(1_000_000) > 20);
});

test('litSegments: how many of the 12 LED segments are on', () => {
  assert.equal(litSegments(0), 0);
  assert.equal(litSegments(0.5), 6);
  assert.equal(litSegments(0.99), 11); // never a full bar before the level-up
  assert.equal(litSegments(1), 12);
  assert.equal(litSegments(-1), 0);
  assert.equal(litSegments(Number.NaN), 0);
  assert.equal(litSegments(5), 12);
});

test('levelUp: the level before and after a drive, only when the drive crossed a level', () => {
  assert.deepEqual(levelUp(120, 50), { from: 1, to: 2 }); // 70 -> 120 crosses 100
  assert.equal(levelUp(90, 50), null); // 40 -> 90, still level 1
  assert.deepEqual(levelUp(903, 903), { from: 1, to: 4 }); // several levels at once
  assert.equal(levelUp(500, 0), null);
  assert.equal(levelUp(Number.NaN, 50), null);
});
