// Recording settings rules. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AUTO_PAUSE_CHOICES_MIN, autoPauseMsFor, parseAutoPauseMin, parseTheme } from '../src/lib/recording-settings.ts';

test('auto-pause choices are 2, 5 and 10 minutes', () => {
  assert.deepEqual([...AUTO_PAUSE_CHOICES_MIN], [2, 5, 10]);
});

test('autoPauseMsFor: minutes to ms, off means never', () => {
  assert.equal(autoPauseMsFor(true, 2), 120_000);
  assert.equal(autoPauseMsFor(true, 5), 300_000);
  assert.equal(autoPauseMsFor(true, 10), 600_000);
  assert.equal(autoPauseMsFor(false, 5), Infinity);
});

test('parseAutoPauseMin: only the three choices, anything else is the 5 minute default', () => {
  assert.equal(parseAutoPauseMin('2'), 2);
  assert.equal(parseAutoPauseMin('10'), 10);
  for (const bad of [null, '', '7', 'abc', '0', '-5']) assert.equal(parseAutoPauseMin(bad), 5, String(bad));
});

test('parseTheme: dark, light, system; anything else is system', () => {
  assert.equal(parseTheme('dark'), 'dark');
  assert.equal(parseTheme('light'), 'light');
  assert.equal(parseTheme('system'), 'system');
  for (const bad of [null, '', 'blue']) assert.equal(parseTheme(bad), 'system', String(bad));
});
