// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { needsSignalConfirm, signalQuality } from '../src/lib/gps-signal.ts';

test('no fix yet is searching', () => {
  assert.equal(signalQuality(null), 'searching');
  assert.equal(signalQuality(undefined), 'searching');
});

test('garbage accuracy is searching, not good', () => {
  assert.equal(signalQuality(NaN), 'searching');
  assert.equal(signalQuality(-1), 'searching');
});

test('5 m or better is excellent', () => {
  assert.equal(signalQuality(3), 'excellent');
  assert.equal(signalQuality(5), 'excellent');
});

test('over 5 m up to 15 m is good', () => {
  assert.equal(signalQuality(5.1), 'good');
  assert.equal(signalQuality(15), 'good');
});

test('over 15 m is weak', () => {
  assert.equal(signalQuality(15.1), 'weak');
  assert.equal(signalQuality(80), 'weak');
});

test('weak and searching ask the driver to confirm before starting', () => {
  assert.equal(needsSignalConfirm('weak'), true);
  assert.equal(needsSignalConfirm('searching'), true);
});

test('good and excellent start without a confirmation', () => {
  assert.equal(needsSignalConfirm('good'), false);
  assert.equal(needsSignalConfirm('excellent'), false);
});
