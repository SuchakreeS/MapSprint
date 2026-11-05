// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { permissionState } from '../src/lib/permission.ts';

test('granted permission is granted', () => {
  assert.equal(permissionState({ status: 'granted', granted: true, canAskAgain: true }), 'granted');
});

test('never asked yet can be asked', () => {
  assert.equal(
    permissionState({ status: 'undetermined', granted: false, canAskAgain: true }),
    'can-ask',
  );
});

test('first denial can still be asked again', () => {
  assert.equal(permissionState({ status: 'denied', granted: false, canAskAgain: true }), 'can-ask');
});

test('denied with "don\'t ask again" needs the settings app', () => {
  assert.equal(permissionState({ status: 'denied', granted: false, canAskAgain: false }), 'blocked');
});

test('undetermined is never blocked, even if canAskAgain is false', () => {
  assert.equal(
    permissionState({ status: 'undetermined', granted: false, canAskAgain: false }),
    'can-ask',
  );
});

test('granted wins over a stale canAskAgain flag', () => {
  assert.equal(permissionState({ status: 'granted', granted: true, canAskAgain: false }), 'granted');
});
