/**
 * Rough remaining-time estimate for a batch job (e.g. parallel PRD drafting).
 * Linear extrapolation from the rate so far. Returns `null` before any item
 * finishes — with no completed item there is no honest rate to project from.
 */
export function estimateRemainingMs(done: number, total: number, elapsedMs: number): number | null {
  if (done <= 0) return null;
  return Math.round((elapsedMs / done) * (total - done));
}
