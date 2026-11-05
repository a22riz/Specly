/**
 * Run `fn` over `items` with at most `limit` calls in flight, preserving order.
 * Uses `min(limit, items.length)` workers pulling from a shared cursor.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workers = Math.min(Math.max(1, limit), items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index], index);
      }
    }),
  );

  return results;
}
