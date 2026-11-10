// Travel modes (Car / Motorbike / Other) and which vehicles fit them. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  carsForMode,
  kindForMode,
  parseTravelMode,
  TRAVEL_MODES,
  vehicleForMode,
  vehicleIdForDrive,
} from '../src/lib/travel-mode.ts';
import { normaliseKind, type Car } from '../src/lib/vehicles.ts';

const v = (id: string, kind: Car['kind']): Car => ({ id, nickname: id, make: null, model: null, colour: 'sport_yellow', kind });
const GARAGE = [v('civic', 'car'), v('scoot', 'motorbike'), v('van', 'car')];

test('there are exactly three modes, car first', () => {
  assert.deepEqual([...TRAVEL_MODES], ['car', 'motorbike', 'other']);
});

test('parseTravelMode keeps a valid saved mode and falls back to car', () => {
  assert.equal(parseTravelMode('motorbike'), 'motorbike');
  assert.equal(parseTravelMode('other'), 'other');
  assert.equal(parseTravelMode('plane'), 'car');
  assert.equal(parseTravelMode(null), 'car');
});

test('kindForMode: car and motorbike use their own kind, other uses no vehicle', () => {
  assert.equal(kindForMode('car'), 'car');
  assert.equal(kindForMode('motorbike'), 'motorbike');
  assert.equal(kindForMode('other'), null);
});

test('carsForMode lists only the vehicles of that kind, nothing for other', () => {
  assert.deepEqual(carsForMode(GARAGE, 'car').map((c) => c.id), ['civic', 'van']);
  assert.deepEqual(carsForMode(GARAGE, 'motorbike').map((c) => c.id), ['scoot']);
  assert.deepEqual(carsForMode(GARAGE, 'other'), []);
});

test('vehicleForMode keeps the saved vehicle of the right kind, else the first of that kind', () => {
  assert.equal(vehicleForMode(GARAGE, 'car', 'van')?.id, 'van');
  assert.equal(vehicleForMode(GARAGE, 'car', 'scoot')?.id, 'civic'); // a motorbike id never fits car mode
  assert.equal(vehicleForMode(GARAGE, 'motorbike', null)?.id, 'scoot');
  assert.equal(vehicleForMode(GARAGE, 'other', 'civic'), null);
  assert.equal(vehicleForMode([v('civic', 'car')], 'motorbike', null), null);
});

test('vehicleIdForDrive stamps a drive only with a vehicle that exists and fits the mode', () => {
  assert.equal(vehicleIdForDrive(GARAGE, 'car', 'civic'), 'civic');
  assert.equal(vehicleIdForDrive(GARAGE, 'motorbike', 'scoot'), 'scoot');
  assert.equal(vehicleIdForDrive(GARAGE, 'car', 'scoot'), null); // wrong kind (DB policy would refuse it)
  assert.equal(vehicleIdForDrive(GARAGE, 'other', 'civic'), null); // Other has no vehicle
  assert.equal(vehicleIdForDrive(GARAGE, 'car', 'deleted-one'), null); // no longer in the garage
  assert.equal(vehicleIdForDrive(GARAGE, 'car', null), null);
});

test('normaliseKind: old cached vehicles without a kind are cars', () => {
  assert.equal(normaliseKind('motorbike'), 'motorbike');
  assert.equal(normaliseKind('car'), 'car');
  assert.equal(normaliseKind(undefined), 'car');
  assert.equal(normaliseKind('tank'), 'car');
});
