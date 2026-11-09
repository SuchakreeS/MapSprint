// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PROMPT_SNOOZE_MS,
  STOP_PROMPT_AUTO_MS,
  STOP_PROMPT_MANUAL_MS,
  shouldPromptFinish,
  stoppedForMs,
} from '../src/lib/finish-prompt.ts';

const MIN = 60_000;
const NOW = 10_000_000;

test('thresholds: 15 min stopped (auto-paused), 30 min manually paused, snooze 15 min', () => {
  assert.equal(STOP_PROMPT_AUTO_MS, 15 * MIN);
  assert.equal(STOP_PROMPT_MANUAL_MS, 30 * MIN);
  assert.equal(PROMPT_SNOOZE_MS, 15 * MIN);
});

test('no pause means no prompt', () => {
  assert.equal(shouldPromptFinish(null, NOW, null), false);
});

test('auto-paused (stopped) prompts from 15 minutes, not before', () => {
  const since = NOW - 15 * MIN + 1;
  assert.equal(shouldPromptFinish({ kind: 'auto', since }, NOW, null), false);
  assert.equal(shouldPromptFinish({ kind: 'auto', since: NOW - 15 * MIN }, NOW, null), true);
  assert.equal(shouldPromptFinish({ kind: 'auto', since: NOW - 88 * MIN }, NOW, null), true);
});

test('a manual pause waits 30 minutes', () => {
  assert.equal(shouldPromptFinish({ kind: 'manual', since: NOW - 29 * MIN }, NOW, null), false);
  assert.equal(shouldPromptFinish({ kind: 'manual', since: NOW - 30 * MIN }, NOW, null), true);
});

test('"Keep recording" snoozes the prompt for 15 minutes', () => {
  const pause = { kind: 'auto' as const, since: NOW - 40 * MIN };
  assert.equal(shouldPromptFinish(pause, NOW, NOW - 1 * MIN), false);
  assert.equal(shouldPromptFinish(pause, NOW, NOW - 14 * MIN), false);
  assert.equal(shouldPromptFinish(pause, NOW, NOW - 15 * MIN), true);
});

test('stoppedForMs is the time since the pause began, never negative', () => {
  assert.equal(stoppedForMs({ kind: 'auto', since: NOW - 20 * MIN }, NOW), 20 * MIN);
  assert.equal(stoppedForMs({ kind: 'auto', since: NOW + 5000 }, NOW), 0);
  assert.equal(stoppedForMs(null, NOW), 0);
});

// ---------- locked-phone reminder: working out "stopped since" from stored points (no live stats there) ----------
import { reminderPauseState } from '../src/lib/finish-prompt.ts';

test('reminderPauseState: a manual pause wins and keeps its own start', () => {
  const s = reminderPauseState({ manualSince: NOW - 40 * MIN, lastMovingTs: NOW - 5 * MIN, sessionStartMs: NOW - 90 * MIN });
  assert.deepEqual(s, { kind: 'manual', since: NOW - 40 * MIN });
});

test('reminderPauseState: otherwise stopped since the last moving point', () => {
  const s = reminderPauseState({ manualSince: null, lastMovingTs: NOW - 20 * MIN, sessionStartMs: NOW - 90 * MIN });
  assert.deepEqual(s, { kind: 'auto', since: NOW - 20 * MIN });
});

test('reminderPauseState: never moved means stopped since the drive started', () => {
  const s = reminderPauseState({ manualSince: null, lastMovingTs: null, sessionStartMs: NOW - 50 * MIN });
  assert.deepEqual(s, { kind: 'auto', since: NOW - 50 * MIN });
});

test('reminder timing end to end: 14 min stopped no, 15 min yes, then snoozed', () => {
  const at = (stoppedMin: number, notifiedAt: number | null) =>
    shouldPromptFinish(
      reminderPauseState({ manualSince: null, lastMovingTs: NOW - stoppedMin * MIN, sessionStartMs: NOW - 120 * MIN }),
      NOW,
      notifiedAt,
    );
  assert.equal(at(14, null), false);
  assert.equal(at(15, null), true);
  assert.equal(at(40, NOW - 5 * MIN), false); // already reminded 5 min ago
  assert.equal(at(40, NOW - 15 * MIN), true); // 15 min later, remind again
});
