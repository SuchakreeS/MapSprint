// Reads every row of a query in pages (Supabase's PostgREST returns at most 1000 rows per request).
// `fetchPage(from, to)` gets the inclusive range, like supabase-js `.range(from, to)`. Stops at the first short page.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}
