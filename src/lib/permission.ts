// Maps an OS permission response to what the UI should do. Pure, no React Native imports.

export interface PermissionInput {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * granted  - nothing to do
 * can-ask  - show the system prompt (first time, or denied once)
 * blocked  - "don't ask again": only the phone's settings can fix it
 */
export type PermissionState = 'granted' | 'can-ask' | 'blocked';

export function permissionState(p: PermissionInput): PermissionState {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined' || p.canAskAgain) return 'can-ask';
  return 'blocked';
}
