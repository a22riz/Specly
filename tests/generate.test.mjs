import assert from "node:assert";
import { selectEmptySections } from "../lib/generate.ts";
import { parseSSERecords } from "../lib/sse.ts";

// RF1: filled sections are skipped, empty/whitespace-only sections are generated.
const defs = [
  { packId: "prd", section: { key: "a", title: "A", enTitle: "A", hint: "", aiPrompt: "" } },
  { packId: "prd", section: { key: "b", title: "B", enTitle: "B", hint: "", aiPrompt: "" } },
  { packId: "prd", section: { key: "c", title: "C", enTitle: "C", hint: "", aiPrompt: "" } },
];
const sectionsMap = new Map([
  ["a", "Existing content"],
  ["b", "   "], // whitespace-only → treat as empty
]);
const empty = selectEmptySections(defs, sectionsMap);
assert.equal(empty.length, 2, "skips filled, includes empty and whitespace-only");
assert.deepEqual(
  empty.map((e) => e.section.key),
  ["b", "c"],
  "only empty sections selected, in order",
);

// RF2: SSE event format emitted by the server round-trips through the parser.
// This is the exact format the server sends: `event: X\ndata: {...}\n\n`
const serverEmit = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const stream = [
  serverEmit("section_start", { pack: "prd", key: "a", title: "A" }),
  serverEmit("section_done", { pack: "prd", key: "a" }),
  serverEmit("section_skip", { key: "b", title: "B" }),
  serverEmit("done", { totalSections: 3, generated: 1, skipped: 1 }),
].join("");
const { events } = parseSSERecords(stream);
assert.equal(events.length, 4, "all four event records parsed — none dropped by parity bug");
assert.equal(events[0].event, "section_start");
assert.equal(events[1].event, "section_done");
assert.equal(events[2].event, "section_skip");
assert.equal(events[3].event, "done");
assert.deepEqual(JSON.parse(events[3].data), { totalSections: 3, generated: 1, skipped: 1 });

console.log("generate.test OK");
