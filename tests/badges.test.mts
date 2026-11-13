// Badge catalogue, progress text and streak (plan 3.6). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BADGES, badgeByCode, badgeProgress, currentStreak, formatBadgeDate, unlockedCount } from '../src/lib/badges.ts';

const none = { cells: 0, distanceM: 0, streakDays: 0 };

test('ten badges, same codes as the database seed, 7 earnable now and 3 coming soon', () => {
  assert.deepEqual(
    BADGES.map((b) => b.code),
    ['first_gear', 'century', 'cartographer_1', 'cartographer_2', 'cartographer_3', 'district_hunter', 'zen_driver', 'weekend_explorer', 'province_collector', 'streak_7'],
  );
  assert.deepEqual(
    BADGES.filter((b) => !b.available).map((b) => b.code),
    ['district_hunter', 'zen_driver', 'province_collector'],
  );
  assert.equal(badgeByCode('century')?.name, 'Century');
  assert.equal(badgeByCode('nope'), undefined);
});

// These must match the XP values in supabase/migrations/20261113130000_badges.sql.
test('badge XP matches the server values', () => {
  const xp = Object.fromEntries(BADGES.map((b) => [b.code, b.xp]));
  assert.deepEqual(xp, {
    first_gear: 50,
    century: 100,
    cartographer_1: 100,
    cartographer_2: 300,
    cartographer_3: 1000,
    district_hunter: 200,
    zen_driver: 150,
    weekend_explorer: 100,
    province_collector: 300,
    streak_7: 200,
  });
});

test('progress: cells and distance and streak show "x / target" and a 0..1 fraction (capped at 1)', () => {
  assert.deepEqual(badgeProgress('cartographer_3', { ...none, cells: 1248 }), { kind: 'progress', text: '1,248 / 10,000 cells', fraction: 0.1248 });
  assert.deepEqual(badgeProgress('cartographer_1', { ...none, cells: 40 }), { kind: 'progress', text: '40 / 100 cells', fraction: 0.4 });
  assert.deepEqual(badgeProgress('cartographer_1', { ...none, cells: 400 }), { kind: 'progress', text: '100 / 100 cells', fraction: 1 });
  assert.deepEqual(badgeProgress('century', { ...none, distanceM: 62_400 }), { kind: 'progress', text: '62 / 100 km', fraction: 0.624 });
  assert.deepEqual(badgeProgress('streak_7', { ...none, streakDays: 4 }), { kind: 'progress', text: '4 / 7 days', fraction: 4 / 7 });
});

test('progress: first gear and weekend explorer have no meter, the three future badges say coming soon', () => {
  assert.deepEqual(badgeProgress('first_gear', none), { kind: 'progress', text: 'Record your first drive', fraction: 0 });
  assert.deepEqual(badgeProgress('weekend_explorer', none), { kind: 'progress', text: '20 new cells on one weekend drive', fraction: 0 });
  for (const code of ['zen_driver', 'district_hunter', 'province_collector']) assert.deepEqual(badgeProgress(code, none), { kind: 'soon' });
  assert.deepEqual(badgeProgress('nope', none), { kind: 'soon' });
});

test('currentStreak: consecutive Bangkok days ending today or yesterday', () => {
  const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  assert.equal(currentStreak(days, '2026-11-13'), 4);
  assert.equal(currentStreak(days, '2026-11-14'), 4); // last drive was yesterday: the streak is still alive
  assert.equal(currentStreak(days, '2026-11-15'), 0); // two days without a drive
  assert.equal(currentStreak(['2026-11-10', '2026-11-12', '2026-11-13'], '2026-11-13'), 2); // a gap ends the run
  assert.equal(currentStreak(['2026-11-13', '2026-11-13'], '2026-11-13'), 1); // two drives the same day count once
  assert.equal(currentStreak([], '2026-11-13'), 0);
  assert.equal(currentStreak(['2026-02-28', '2026-03-01'], '2026-03-01'), 2); // no 29 Feb in 2026: 28 Feb and 1 Mar are neighbours
  assert.equal(currentStreak(['2028-02-28', '2028-03-01'], '2028-03-01'), 1); // 29 Feb 2028 exists: that is a gap
  assert.equal(currentStreak(['2026-12-31', '2027-01-01'], '2027-01-01'), 2); // year change
});

test('unlockedCount counts distinct known codes', () => {
  assert.equal(unlockedCount(['first_gear', 'century', 'first_gear', 'mystery']), 2);
  assert.equal(unlockedCount([]), 0);
});

test('formatBadgeDate: "14 Nov" in Bangkok time, empty for rubbish', () => {
  assert.equal(formatBadgeDate('2026-11-13T17:30:00Z'), '14 Nov'); // 00:30 in Bangkok, the next day
  assert.equal(formatBadgeDate('2026-08-12T05:00:00Z'), '12 Aug');
  assert.equal(formatBadgeDate('2026-01-01T00:00:00+00:00'), '1 Jan');
  assert.equal(formatBadgeDate('nope'), '');
});
