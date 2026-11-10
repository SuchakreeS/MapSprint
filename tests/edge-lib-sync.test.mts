// The finalize-drive Edge Function runs a COPY of these rules (it is deployed from its own folder). A stale copy would make the
// server count drives differently from the app. If this fails, run: npm run sync:edge
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// @ts-expect-error plain .mjs script without types
import { COPY_DIR, SHARED_FILES, SRC_DIR } from '../scripts/sync-edge-lib.mjs';

for (const f of SHARED_FILES as string[]) {
  test(`edge copy of ${f} is identical to src/lib`, () => {
    const src = readFileSync(join(SRC_DIR as string, f), 'utf8');
    const copy = readFileSync(join(COPY_DIR as string, f), 'utf8');
    assert.equal(copy, src, `${f} differs: run npm run sync:edge`);
  });
}
