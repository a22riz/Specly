import assert from "node:assert";
import { parseSSERecords } from "../lib/sse.ts";

// The original bug: stepping lines by 2 dropped every other event because
// the blank-line separator between SSE records shifted parity.
// This test would have caught it.
const { events, remainder } = parseSSERecords(
  'event: section_start\ndata: {"key":"a"}\n\nevent: section_done\ndata: {"key":"a"}\n\n',
);
assert.equal(events.length, 2, "parses both records, not every other one");
assert.equal(events[0].event, "section_start");
assert.equal(events[0].data, '{"key":"a"}');
assert.equal(events[1].event, "section_done");
assert.equal(remainder, "", "no remainder when all records complete");

// Incomplete record stays in remainder, not emitted as event.
const partial = parseSSERecords('event: chunk\ndata: {"text":"hel');
assert.equal(partial.events.length, 0, "incomplete record not emitted");
assert.ok(partial.remainder.length > 0, "incomplete record kept as remainder");

// Streaming: first read ends mid-record, second completes it.
const first = parseSSERecords(
  'event: chunk\ndata: {"text":"hello"}\n\nevent: chunk\ndata: {"text":"',
);
assert.equal(first.events.length, 1, "first read emits one complete record");
const second = parseSSERecords(first.remainder + 'world"}\n\n');
assert.equal(second.events.length, 1, "second read emits the completed record");
assert.equal(second.remainder, "", "remainder empty after completion");

console.log("sse.test OK");
