import assert from "node:assert/strict";
import { parseDiscoveryTurn, canAskMore, DISCOVERY_MAX } from "../lib/discovery.ts";

const t = parseDiscoveryTurn(
  '{"say":"Oke","question":{"text":"Pembayaran?","options":["Transfer","QRIS"]},"done":false}',
);
assert.equal(t.say, "Oke");
assert.equal(t.question.text, "Pembayaran?");
assert.deepEqual(t.question.options, ["Transfer", "QRIS"]);
assert.equal(t.done, false);

const fenced = parseDiscoveryTurn('```json\n{"say":"","question":null,"done":true}\n```');
assert.equal(fenced.done, true);
assert.equal(fenced.question, null);

// prose reply never throws; degrades to a plain turn
const prose = parseDiscoveryTurn("Apa nama aplikasimu?");
assert.equal(prose.question, null);
assert.equal(prose.done, false);
assert.match(prose.say, /nama aplikasi/);

// question with no valid string options is dropped
const bad = parseDiscoveryTurn('{"question":{"text":"x","options":[1,null]},"done":false}');
assert.equal(bad.question, null);

assert.equal(canAskMore(0), true);
assert.equal(canAskMore(DISCOVERY_MAX - 1), true);
assert.equal(canAskMore(DISCOVERY_MAX), false);
assert.equal(DISCOVERY_MAX, 8);

console.log("discovery.test OK");
