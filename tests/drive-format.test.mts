// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  driveTitle,
  formatDateTimeRange,
  formatDriveCount,
  formatDriveDay,
  groupByMonth,
  isJunkDrive,
  monthLabel,
} from '../src/lib/drive-format.ts';

// Local-time constructor: the formatters use the phone's local time, so the tests do too.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test('title follows the time of day', () => {
  assert.equal(driveTitle(at(2026, 11, 3, 7, 12)), 'Morning drive');
  assert.equal(driveTitle(at(2026, 11, 3, 13, 0)), 'Afternoon drive');
  assert.equal(driveTitle(at(2026, 11, 3, 19, 30)), 'Evening drive');
  assert.equal(driveTitle(at(2026, 11, 3, 23, 30)), 'Night drive');
  assert.equal(driveTitle(at(2026, 11, 3, 2, 0)), 'Night drive');
});

test('title boundaries: 05:00 morning, 11:00 afternoon, 17:00 evening, 21:00 night', () => {
  assert.equal(driveTitle(at(2026, 11, 3, 4, 59)), 'Night drive');
  assert.equal(driveTitle(at(2026, 11, 3, 5, 0)), 'Morning drive');
  assert.equal(driveTitle(at(2026, 11, 3, 10, 59)), 'Morning drive');
  assert.equal(driveTitle(at(2026, 11, 3, 11, 0)), 'Afternoon drive');
  assert.equal(driveTitle(at(2026, 11, 3, 16, 59)), 'Afternoon drive');
  assert.equal(driveTitle(at(2026, 11, 3, 17, 0)), 'Evening drive');
  assert.equal(driveTitle(at(2026, 11, 3, 20, 59)), 'Evening drive');
  assert.equal(driveTitle(at(2026, 11, 3, 21, 0)), 'Night drive');
});

test('day label is weekday and date', () => {
  assert.equal(formatDriveDay(at(2026, 11, 3, 7, 12)), 'Tue 3');
  assert.equal(formatDriveDay(at(2026, 10, 25, 9, 0)), 'Sun 25');
});

test('month label is upper case with the year', () => {
  assert.equal(monthLabel(at(2026, 11, 3)), 'NOVEMBER 2026');
  assert.equal(monthLabel(at(2026, 1, 15)), 'JANUARY 2026');
});

test('date and time range like the recap header', () => {
  assert.equal(
    formatDateTimeRange(at(2026, 11, 3, 7, 12), at(2026, 11, 3, 7, 44)),
    'Tue 3 Nov · 07:12 → 07:44 · 32 min',
  );
});

test('range handles a drive shorter than a minute and one that crosses midnight', () => {
  assert.equal(
    formatDateTimeRange(at(2026, 11, 3, 7, 12), at(2026, 11, 3, 7, 12) + 20_000),
    'Tue 3 Nov · 07:12 → 07:12 · <1 min',
  );
  assert.equal(
    formatDateTimeRange(at(2026, 11, 3, 23, 50), at(2026, 11, 4, 0, 20)),
    'Tue 3 Nov · 23:50 → 00:20 · 30 min',
  );
});

test('range adds active time when auto-pause made it clearly shorter', () => {
  assert.equal(
    formatDateTimeRange(at(2026, 11, 5, 17, 55), at(2026, 11, 5, 18, 37), 36 * 60 + 40),
    'Thu 5 Nov · 17:55 → 18:37 · 42 min · 36:40 active',
  );
});

test('range leaves active time out when it matches the wall clock (within a minute)', () => {
  assert.equal(
    formatDateTimeRange(at(2026, 11, 3, 7, 12), at(2026, 11, 3, 7, 44), 32 * 60 - 20),
    'Tue 3 Nov · 07:12 → 07:44 · 32 min',
  );
});

test('drives under 100 m are junk, 100 m and more are kept', () => {
  assert.equal(isJunkDrive(0), true);
  assert.equal(isJunkDrive(99.9), true);
  assert.equal(isJunkDrive(100), false);
  assert.equal(isJunkDrive(7860), false);
});

test('drive count is singular for one', () => {
  assert.equal(formatDriveCount(1), '1 drive');
  assert.equal(formatDriveCount(2), '2 drives');
  assert.equal(formatDriveCount(0), '0 drives');
});

test('drives are grouped by month, newest first, in the order given', () => {
  const items = [
    { id: 4, startedAt: at(2026, 11, 3, 7) },
    { id: 3, startedAt: at(2026, 11, 1, 12) },
    { id: 2, startedAt: at(2026, 10, 31, 22) },
    { id: 1, startedAt: at(2026, 10, 25, 9) },
  ];
  const groups = groupByMonth(items);
  assert.deepEqual(
    groups.map((g) => [g.label, g.items.map((i) => i.id)]),
    [
      ['NOVEMBER 2026', [4, 3]],
      ['OCTOBER 2026', [2, 1]],
    ],
  );
});

test('the same month in different years stays separate', () => {
  const groups = groupByMonth([
    { id: 2, startedAt: at(2027, 1, 2) },
    { id: 1, startedAt: at(2026, 1, 2) },
  ]);
  assert.deepEqual(groups.map((g) => g.label), ['JANUARY 2027', 'JANUARY 2026']);
});

test('no drives means no groups', () => {
  assert.deepEqual(groupByMonth([]), []);
});

import { formatClockTime } from '../src/lib/drive-format.ts';

test('clock time with seconds', () => {
  assert.equal(formatClockTime(at(2026, 11, 3, 7, 5) + 9_000), '07:05:09');
  assert.equal(formatClockTime(at(2026, 11, 3, 23, 59) + 59_000), '23:59:59');
  assert.equal(formatClockTime(at(2026, 11, 3, 0, 0)), '00:00:00');
});
