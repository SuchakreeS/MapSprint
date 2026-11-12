// Paged reads past the PostgREST 1000-row cap (plan 3.4). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fetchAllPages } from '../src/lib/paging.ts';

function fakeTable(n: number) {
  const calls: [number, number][] = [];
  const rows = Array.from({ length: n }, (_, i) => `r${i}`);
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  };
  return { calls, rows, fetchPage };
}

test('2500 rows: 3 pages', async () => {
  const t = fakeTable(2500);
  assert.deepEqual(await fetchAllPages(t.fetchPage), t.rows);
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('exactly 1000 rows: a second, empty page ends it', async () => {
  const t = fakeTable(1000);
  assert.equal((await fetchAllPages(t.fetchPage)).length, 1000);
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999]]);
});

test('0 rows: one call', async () => {
  const t = fakeTable(0);
  assert.deepEqual(await fetchAllPages(t.fetchPage), []);
  assert.equal(t.calls.length, 1);
});

test('custom page size and errors pass through', async () => {
  const t = fakeTable(5);
  assert.equal((await fetchAllPages(t.fetchPage, 2)).length, 5);
  await assert.rejects(fetchAllPages(async () => { throw new Error('offline'); }), /offline/);
});
