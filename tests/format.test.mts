// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatCount, formatDistanceKm, formatDuration, formatKmh1, formatSpeedKmh } from '../src/lib/format.ts';

test('speed rounds to a whole number', () => {
  assert.equal(formatSpeedKmh(42.4), '42');
  assert.equal(formatSpeedKmh(0), '0');
});

test('speed shows -- when unknown, negative or not a number', () => {
  assert.equal(formatSpeedKmh(null), '--');
  assert.equal(formatSpeedKmh(undefined), '--');
  assert.equal(formatSpeedKmh(-1), '--');
  assert.equal(formatSpeedKmh(NaN), '--');
});

test('distance is km with 2 decimals', () => {
  assert.equal(formatDistanceKm(0), '0.00');
  assert.equal(formatDistanceKm(2370), '2.37');
  assert.equal(formatDistanceKm(9410.4), '9.41');
});

test('distance falls back to 0.00 for negative or NaN', () => {
  assert.equal(formatDistanceKm(-5), '0.00');
  assert.equal(formatDistanceKm(NaN), '0.00');
});

test('duration is M:SS under an hour', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3599), '59:59');
});

test('duration rolls over to H:MM:SS from one hour', () => {
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(5327), '1:28:47');
  assert.equal(formatDuration(40000), '11:06:40');
});

test('duration falls back to 0:00 for negative or NaN', () => {
  assert.equal(formatDuration(-3), '0:00');
  assert.equal(formatDuration(NaN), '0:00');
});

test('speed with one decimal, or -- when unknown', () => {
  assert.equal(formatKmh1(40.84), '40.8');
  assert.equal(formatKmh1(0), '0.0');
  assert.equal(formatKmh1(null), '--');
  assert.equal(formatKmh1(-1), '--');
  assert.equal(formatKmh1(NaN), '--');
});

test('distance can show one decimal (HUD)', () => {
  assert.equal(formatDistanceKm(12_700, 1), '12.7');
  assert.equal(formatDistanceKm(12_749, 1), '12.7');
  assert.equal(formatDistanceKm(0, 1), '0.0');
  assert.equal(formatDistanceKm(NaN, 1), '0.0');
});

test('formatCount groups thousands with commas', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1248), '1,248');
  assert.equal(formatCount(1234567), '1,234,567');
});
