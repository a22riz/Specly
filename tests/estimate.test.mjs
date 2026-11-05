import assert from "node:assert/strict";
import { estimateRemainingMs } from "../lib/estimate.ts";

assert.equal(estimateRemainingMs(0, 12, 5000), null);
assert.equal(estimateRemainingMs(3, 12, 3000), 9000);
assert.equal(estimateRemainingMs(12, 12, 9000), 0);
console.log("estimate.test OK");
