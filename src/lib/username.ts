// Username rules. Must match the database check on public.profiles.username: ^[a-z0-9_.]{3,20}$

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export type UsernameProblem = 'too-short' | 'too-long' | 'bad-chars';

/** What the user typed, as it will be saved: trimmed, lowercase, no leading @. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** Null when the (already normalised) username is valid. */
export function usernameProblem(u: string): UsernameProblem | null {
  if (u.length < USERNAME_MIN) return 'too-short';
  if (u.length > USERNAME_MAX) return 'too-long';
  if (!/^[a-z0-9_.]+$/.test(u)) return 'bad-chars';
  return null;
}
