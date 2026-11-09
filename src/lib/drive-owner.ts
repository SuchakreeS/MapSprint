// Which account a drive stored on this phone belongs to (PS decision 2026-11-09).
// ownerId null = recorded as a guest. Guest drives go to the next account that signs up or logs in;
// a signed-out account's drives stay on the phone but are hidden until it signs back in.

/** Is a local drive shown to whoever is using the app now (null = guest)? */
export function visibleTo(ownerId: string | null, currentUserId: string | null): boolean {
  return ownerId === currentUserId;
}

/** Can an account that just signed in take this drive over? Only guest drives can. */
export function claimable(ownerId: string | null): boolean {
  return ownerId == null;
}
