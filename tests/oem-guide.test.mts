// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OEM_GUIDES, detectOem, orderedGuides } from '../src/lib/oem-guide.ts';

test('detects the phone maker from manufacturer and brand', () => {
  assert.equal(detectOem('samsung', 'samsung'), 'samsung');
  assert.equal(detectOem('Xiaomi', 'Redmi'), 'xiaomi');
  assert.equal(detectOem('Xiaomi', 'POCO'), 'xiaomi');
  assert.equal(detectOem('OPPO', 'OPPO'), 'oppo');
  assert.equal(detectOem('realme', 'realme'), 'realme');
  assert.equal(detectOem('vivo', 'vivo'), 'vivo');
  assert.equal(detectOem('HUAWEI', 'HUAWEI'), 'huawei');
  assert.equal(detectOem('HONOR', 'HONOR'), 'huawei');
  assert.equal(detectOem('OnePlus', 'OnePlus'), 'oneplus');
  assert.equal(detectOem('Google', 'google'), 'google');
});

test('an unknown or missing maker is "other"', () => {
  assert.equal(detectOem('motorola', 'motorola'), 'other');
  assert.equal(detectOem(null, null), 'other');
  assert.equal(detectOem(undefined, undefined), 'other');
  assert.equal(detectOem('', ''), 'other');
});

test('detection ignores case and extra spaces', () => {
  assert.equal(detectOem('  SAMSUNG ', null), 'samsung');
  assert.equal(detectOem(null, 'Redmi'), 'xiaomi');
});

test('your phone comes first, the rest keep their order, nothing is duplicated', () => {
  const ids = orderedGuides('xiaomi').map((g) => g.id);
  assert.equal(ids[0], 'xiaomi');
  assert.equal(new Set(ids).size, OEM_GUIDES.length);
  assert.deepEqual(
    ids.slice(1),
    OEM_GUIDES.map((g) => g.id).filter((id) => id !== 'xiaomi'),
  );
});

test('an unknown phone starts with the stock Android steps', () => {
  assert.equal(orderedGuides('other')[0].id, 'google');
  assert.equal(orderedGuides('other').length, OEM_GUIDES.length);
});

test('every guide has a name and at least three non-empty steps', () => {
  for (const g of OEM_GUIDES) {
    assert.ok(g.name.length > 0, g.id);
    assert.ok(g.steps.length >= 3, `${g.id} has ${g.steps.length} steps`);
    for (const s of g.steps) assert.ok(s.trim().length > 10, `${g.id}: "${s}"`);
  }
});

test('Samsung steps cover the settings that undo the others (Adaptive battery, sleeping apps)', () => {
  const text = OEM_GUIDES.find((g) => g.id === 'samsung')!.steps.join(' ');
  assert.match(text, /Unrestricted/);
  assert.match(text, /Adaptive battery/);
  assert.match(text, /Put unused apps to sleep/);
});
