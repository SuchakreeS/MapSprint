// Password rule for email sign-up (hidden until email confirmation exists).
// Matches Supabase's "letters and digits" strength option with a minimum length of 8.

export const PASSWORD_MIN = 8;

export type PasswordProblem = 'too-short' | 'needs-letter' | 'needs-number';

export function passwordProblem(p: string): PasswordProblem | null {
  if (p.length < PASSWORD_MIN) return 'too-short';
  if (!/\p{L}/u.test(p)) return 'needs-letter';
  if (!/\d/.test(p)) return 'needs-number';
  return null;
}
