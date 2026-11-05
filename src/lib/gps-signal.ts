// Rates a GPS fix from its horizontal accuracy radius. Pure, no React Native imports.
// Note geo.ts drops points worse than 25 m when cleaning; "weak" starts earlier so the
// driver is warned before that happens.

export type SignalQuality = 'searching' | 'weak' | 'good' | 'excellent';

export function signalQuality(accuracyM: number | null | undefined): SignalQuality {
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM < 0) return 'searching';
  if (accuracyM <= 5) return 'excellent';
  if (accuracyM <= 15) return 'good';
  return 'weak';
}

/** True when the driver must confirm before recording: a weak or missing fix can skew distance. */
export function needsSignalConfirm(quality: SignalQuality): boolean {
  return quality === 'weak' || quality === 'searching';
}
