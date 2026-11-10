// Car picker rules (pre-drive screen). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { carSubtitle, pickSelected, type Car } from '../src/lib/vehicles.ts';

const car = (id: string, over: Partial<Car> = {}): Car => ({
  id,
  nickname: id,
  make: null,
  model: null,
  colour: 'sport_yellow',
  kind: 'car',
  ...over,
});

test('pickSelected keeps the saved car while it still exists', () => {
  assert.equal(pickSelected([car('a'), car('b')], 'b')?.id, 'b');
});

test('pickSelected falls back to the first car when the saved one is gone or unset', () => {
  assert.equal(pickSelected([car('a'), car('b')], 'zzz')?.id, 'a');
  assert.equal(pickSelected([car('a'), car('b')], null)?.id, 'a');
});

test('pickSelected returns null with no cars', () => {
  assert.equal(pickSelected([], 'a'), null);
});

test('carSubtitle joins colour with make and model, skipping empty parts', () => {
  assert.equal(carSubtitle(car('a', { make: 'Honda', model: 'Civic' }), 'Sport yellow'), 'Sport yellow · Honda Civic');
  assert.equal(carSubtitle(car('a', { model: 'hatchback' }), 'Sport yellow'), 'Sport yellow · hatchback');
  assert.equal(carSubtitle(car('a', { make: '  ', model: '' }), 'Racing red'), 'Racing red');
});
