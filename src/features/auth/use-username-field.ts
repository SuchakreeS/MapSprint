// Username field with a debounced "is it free?" check. Used by onboarding step 4 and Edit profile.
// The unique constraint in the database is the final word on save (error 23505 -> call markTaken).
import { useEffect, useState } from 'react';

import { supabase } from '@/features/sync/supabase';
import { normalizeUsername, usernameProblem, type UsernameProblem } from '@/lib/username';

const CHECK_DELAY_MS = 400;

const PROBLEM_TEXT: Record<UsernameProblem, string> = {
  'too-short': 'At least 3 characters.',
  'too-long': 'At most 20 characters.',
  'bad-chars': 'Use only a–z, 0–9, _ and .',
};

export function useUsernameField(userId: string | null, initial: string | null | undefined) {
  const [rawUsername, setRawUsername] = useState(initial ?? '');
  /** Result of the last availability check, tagged with the username it was for. */
  const [check, setCheck] = useState<{ u: string; taken: boolean } | null>(null);

  const username = normalizeUsername(rawUsername);
  const problem = username.length > 0 ? usernameProblem(username) : null;

  useEffect(() => {
    if (!userId || username.length === 0 || usernameProblem(username)) return;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .limit(1);
      if (error) return; // offline: never claim "available" without an answer; the save checks again
      setCheck({ u: username, taken: (data?.length ?? 0) > 0 });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [username, userId]);

  const known = check?.u === username ? check : null;
  const status: 'error' | 'ok' | 'normal' = problem || known?.taken ? 'error' : known ? 'ok' : 'normal';
  const hint = problem
    ? PROBLEM_TEXT[problem]
    : known?.taken
      ? 'That username is taken.'
      : known
        ? 'Username is available'
        : username
          ? 'Checking…'
          : 'Friends find you by this.';

  return {
    rawUsername,
    setRawUsername,
    username,
    status,
    hint,
    /** Valid and not known to be taken (the save still checks). */
    usable: username.length > 0 && !problem && known?.taken !== true,
    markTaken: () => setCheck({ u: username, taken: true }),
  };
}
