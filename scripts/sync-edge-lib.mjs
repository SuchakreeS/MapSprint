// Copies the pure rules the finalize-drive Edge Function shares with the app from src/lib into the function's own folder.
// Edge Functions are deployed from their own folder, so they cannot import from src/. The copies must stay IDENTICAL:
// run `npm run sync:edge` after changing any of these files; tests/edge-lib-sync.test.mts fails if a copy is stale.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SHARED_FILES = [
  'cells.ts',
  'finalize.ts',
  'geo.ts',
  'live-stats.ts',
  'route-art.ts',
  'route-line.ts',
  'top-speed.ts',
  'track-format.ts',
  'travel-mode.ts',
  'upload-queue.ts',
  'vehicles.ts',
  'xp.ts',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = join(root, 'src', 'lib');
export const COPY_DIR = join(root, 'supabase', 'functions', 'finalize-drive', 'lib');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(COPY_DIR, { recursive: true });
  for (const f of SHARED_FILES) copyFileSync(join(SRC_DIR, f), join(COPY_DIR, f));
  console.log(`Copied ${SHARED_FILES.length} files to ${COPY_DIR}`);
}
