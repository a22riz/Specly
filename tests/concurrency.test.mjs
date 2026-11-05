import assert from "node:assert";
import { mapLimit } from "../lib/concurrency.ts";

let active = 0, peak = 0;
const out = await mapLimit([1,2,3,4,5,6], 2, async (n) => {
  active++; peak = Math.max(peak, active);
  await new Promise((r) => setTimeout(r, 5));
  active--; return n * 2;
});
assert.deepEqual(out, [2,4,6,8,10,12], "order preserved");
assert.ok(peak <= 2, `concurrency capped (peak ${peak})`);
console.log("concurrency.test OK");
