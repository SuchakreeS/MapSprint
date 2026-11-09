// Letter avatar (design 04): the first character of the display name, else of the username.

export function avatarInitial(displayName: string | null | undefined, username: string | null | undefined): string {
  for (const s of [displayName, username]) {
    const first = Array.from(s?.trim() ?? '')[0];
    if (first) return first.toLocaleUpperCase();
  }
  return '?';
}

// Photo files: avatars/<uid>/avatar-<ms>.jpg. A new name per upload, so a changed photo never shows a cached
// old one. Same rule as the database check profiles_avatar_url_own (keep both in sync).
export const avatarPath = (userId: string, version: number): string => `${userId}/avatar-${version}.jpg`;

export function isOwnAvatarPath(userId: string, path: string): boolean {
  const prefix = `${userId}/`;
  if (!path.startsWith(prefix)) return false;
  return /^avatar(-[0-9]{1,16})?\.jpg$/.test(path.slice(prefix.length));
}
