// What the Saving screen (design 09) shows while a finished drive uploads and the server counts it.
// Pure, no React Native imports so it runs in Node tests too.
import type { UploadState } from './upload-queue.ts';

/** Where the runner is with the current drive (kept in memory by the upload runner). */
export type UploadPhase = 'preparing' | 'row' | 'track' | 'server';

/** After this long without being counted we stop watching: the drive is safe on the phone and uploads by itself. */
export const NO_SIGNAL_AFTER_MS = 10_000;

export type StepState = 'waiting' | 'working' | 'done';

export interface SavingView {
  percent: number;
  label: 'uploading' | 'checking' | 'done';
  steps: { cleaned: StepState; speed: StepState };
  /** wait = keep showing; counted = open the recap; rejected = say why; local = nothing to count, open the local recap. */
  outcome: 'wait' | 'counted' | 'rejected' | 'local';
  noSignal: boolean;
}

const PHASE_PERCENT: Record<UploadPhase, number> = { preparing: 15, row: 35, track: 65, server: 90 };
/** Rejected before upload because there is nothing worth counting (a tap on Start, a few metres). */
const NOTHING_TO_COUNT = ['junk', 'too_few_points'];

export function savingView(
  row: { state: UploadState; attempts: number; reason: string | null } | null,
  phase: UploadPhase | null,
  sinceStartMs: number,
): SavingView {
  const state = row?.state ?? 'queued';
  if (state === 'counted') {
    return { percent: 100, label: 'done', steps: { cleaned: 'done', speed: 'done' }, outcome: 'counted', noSignal: false };
  }
  if (state === 'rejected') {
    const local = row?.reason != null && NOTHING_TO_COUNT.includes(row.reason);
    return {
      percent: 100,
      label: 'done',
      steps: { cleaned: 'waiting', speed: 'waiting' },
      outcome: local ? 'local' : 'rejected',
      noSignal: false,
    };
  }
  const uploading = state === 'uploading' ? (phase ?? 'preparing') : null;
  const checking = uploading === 'server';
  return {
    percent: uploading ? PHASE_PERCENT[uploading] : 8,
    label: checking ? 'checking' : 'uploading',
    steps: { cleaned: checking ? 'working' : 'waiting', speed: 'waiting' },
    outcome: 'wait',
    noSignal: sinceStartMs >= NO_SIGNAL_AFTER_MS,
  };
}
