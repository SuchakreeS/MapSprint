// Letter avatar (design 04): the first character of the display name, else of the username.

export function avatarInitial(displayName: string | null | undefined, username: string | null | undefined): string {
  for (const s of [displayName, username]) {
    const first = Array.from(s?.trim() ?? '')[0];
    if (first) return first.toLocaleUpperCase();
  }
  return '?';
}
