// Garage (23) and edit profile rules. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avatarPath, isOwnAvatarPath } from '../src/lib/avatar.ts';
import { carStats } from '../src/lib/vehicles.ts';

const UID = '11111111-1111-1111-1111-111111111111';

// ---------- photo file names (same rule as the DB check profiles_avatar_url_own) ----------
test('each upload gets its own file name in the user folder', () => {
  assert.equal(avatarPath(UID, 1731100000000), `${UID}/avatar-1731100000000.jpg`);
});

test('own paths pass: the old fixed name and versioned names', () => {
  assert.ok(isOwnAvatarPath(UID, `${UID}/avatar.jpg`));
  assert.ok(isOwnAvatarPath(UID, avatarPath(UID, 42)));
});

test('someone else\'s folder, other names and tricks fail', () => {
  const other = '22222222-2222-2222-2222-222222222222';
  assert.ok(!isOwnAvatarPath(UID, `${other}/avatar-1.jpg`));
  assert.ok(!isOwnAvatarPath(UID, `${UID}/avatar-.jpg`));
  assert.ok(!isOwnAvatarPath(UID, `${UID}/avatar-1.jpg/../x.jpg`));
  assert.ok(!isOwnAvatarPath(UID, `${UID}/photo.jpg`));
  assert.ok(!isOwnAvatarPath(UID, `x${UID}/avatar.jpg`));
});

// ---------- per-car totals on the Garage cards ----------
test('carStats sums distance and counts drives for one car only', () => {
  const drives = [
    { vehicleId: 'a', distanceM: 1500 },
    { vehicleId: 'b', distanceM: 9000 },
    { vehicleId: 'a', distanceM: 2500 },
    { vehicleId: null, distanceM: 700 },
  ];
  assert.deepEqual(carStats(drives, 'a'), { drives: 2, distanceM: 4000 });
  assert.deepEqual(carStats(drives, 'zzz'), { drives: 0, distanceM: 0 });
});
