// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planLaunchCleanup, planStart } from '../src/lib/recording-state.ts';

test('planStart: GPS running and a drive open -> keep using that drive', () => {
  assert.deepEqual(planStart({ updatesRunning: true, activeSessionId: 7 }), { kind: 'reuse', sessionId: 7 });
});

test('planStart: drive open but GPS not running (process killed / task lost) -> restart GPS on the SAME drive', () => {
  assert.deepEqual(planStart({ updatesRunning: false, activeSessionId: 7 }), { kind: 'resume', sessionId: 7 });
});

test('planStart: no drive open -> new drive, whether or not stray GPS updates are running', () => {
  assert.deepEqual(planStart({ updatesRunning: false, activeSessionId: null }), { kind: 'new' });
  assert.deepEqual(planStart({ updatesRunning: true, activeSessionId: null }), { kind: 'new' });
});

test('planLaunchCleanup: GPS task registered but no drive open -> stop the orphan', () => {
  assert.equal(planLaunchCleanup({ updatesRunning: true, activeSessionId: null }), 'stop-orphan');
});

test('planLaunchCleanup: never starts GPS at launch; a drive left open is resumed only from the HUD', () => {
  assert.equal(planLaunchCleanup({ updatesRunning: false, activeSessionId: 3 }), 'none');
  assert.equal(planLaunchCleanup({ updatesRunning: true, activeSessionId: 3 }), 'none');
  assert.equal(planLaunchCleanup({ updatesRunning: false, activeSessionId: null }), 'none');
});
