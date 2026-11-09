// Pure rules behind sign-in and onboarding (2.2). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avatarInitial } from '../src/lib/avatar.ts';
import { claimable, visibleTo } from '../src/lib/drive-owner.ts';
import { nextRoute, type OnboardingState } from '../src/lib/onboarding.ts';
import { passwordProblem } from '../src/lib/password.ts';
import { normalizeUsername, usernameProblem } from '../src/lib/username.ts';

// ---------- username (same rule as the database check ^[a-z0-9_.]{3,20}$) ----------
test('username is trimmed, lowercased and loses a leading @', () => {
  assert.equal(normalizeUsername('  @Nok_Drives '), 'nok_drives');
});

test('valid usernames pass', () => {
  for (const u of ['abc', 'nok_drives', 'a.b_c9', 'x'.repeat(20)]) assert.equal(usernameProblem(u), null, u);
});

test('too short, too long and bad characters are reported', () => {
  assert.equal(usernameProblem('ab'), 'too-short');
  assert.equal(usernameProblem('x'.repeat(21)), 'too-long');
  assert.equal(usernameProblem('nok drives'), 'bad-chars');
  assert.equal(usernameProblem('nok-drives'), 'bad-chars');
  assert.equal(usernameProblem('NOK'), 'bad-chars'); // callers normalise first
  assert.equal(usernameProblem('นก_drives'), 'bad-chars');
});

// ---------- letter avatar ----------
test('initial comes from the display name, uppercased', () => {
  assert.equal(avatarInitial('nok', 'someone'), 'N');
});

test('falls back to the username, then to ?', () => {
  assert.equal(avatarInitial('  ', 'drive_guy'), 'D');
  assert.equal(avatarInitial(null, null), '?');
});

test('a Thai display name gives its first character', () => {
  assert.equal(avatarInitial('นก', null), 'น');
});

// ---------- password (email sign-up, hidden for now) ----------
test('password needs 8+ characters with a letter and a number', () => {
  assert.equal(passwordProblem('abc12345'), null);
  assert.equal(passwordProblem('abc1234'), 'too-short');
  assert.equal(passwordProblem('12345678'), 'needs-letter');
  assert.equal(passwordProblem('abcdefgh'), 'needs-number');
});

// ---------- onboarding route ----------
const fresh: OnboardingState = {
  signedIn: false,
  guest: false,
  locationDone: false,
  hasUsername: false,
  carDone: false,
};

test('nobody yet: welcome', () => {
  assert.equal(nextRoute(fresh), 'welcome');
});

test('guest: location step once, then the app; never profile or car', () => {
  assert.equal(nextRoute({ ...fresh, guest: true }), 'location');
  assert.equal(nextRoute({ ...fresh, guest: true, locationDone: true }), 'tabs');
});

test('new account: location, then profile, then car, then the app', () => {
  const s = { ...fresh, signedIn: true };
  assert.equal(nextRoute(s), 'location');
  assert.equal(nextRoute({ ...s, locationDone: true }), 'about-you');
  assert.equal(nextRoute({ ...s, locationDone: true, hasUsername: true }), 'car');
  assert.equal(nextRoute({ ...s, locationDone: true, hasUsername: true, carDone: true }), 'tabs');
});

test('signed in wins over a leftover guest flag', () => {
  assert.equal(nextRoute({ ...fresh, signedIn: true, guest: true, locationDone: true }), 'about-you');
});

// ---------- local drive ownership ----------
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

test('a guest sees only guest drives', () => {
  assert.equal(visibleTo(null, null), true);
  assert.equal(visibleTo(A, null), false);
});

test('an account sees only its own drives, not guest or other accounts', () => {
  assert.equal(visibleTo(A, A), true);
  assert.equal(visibleTo(B, A), false);
  assert.equal(visibleTo(null, A), false);
});

test('only guest drives can be claimed by an account', () => {
  assert.equal(claimable(null), true);
  assert.equal(claimable(A), false);
});
