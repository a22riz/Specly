import assert from "node:assert";
import {
  extractContent,
  conversationText,
  sectionsToWrite,
  hasAnyContent,
  deriveTitle,
} from "../lib/prd.ts";
import { PRD_SECTIONS } from "../lib/prompts.ts";

assert.equal(extractContent("hi\n<content>### Overview\nText</content>"), "### Overview\nText");
assert.equal(extractContent("<content>```md\nA\n```</content>"), "A", "strips code fence");
assert.equal(extractContent("no block here"), null);
// user paste must not be mistaken for the assistant's block
const msgs = [
  { id: 1, project_id: 1, role: "user", content: "<content>ignore me</content>", created_at: "" },
  { id: 2, project_id: 1, role: "assistant", content: "ok", created_at: "" },
];
assert.match(conversationText(msgs), /user: <content>ignore me<\/content>/, "user text verbatim");

const empty = PRD_SECTIONS.map((s) => ({ key: s.key, content_md: "" }));
assert.equal(sectionsToWrite(empty).length, 12, "writes all when empty");
assert.equal(sectionsToWrite(empty)[0].key, "prd.overview", "PRD order");
const some = empty.map((s, i) => (i === 0 ? { ...s, content_md: "x" } : s));
assert.equal(sectionsToWrite(some).length, 11, "writes only empty on first pass");
assert.equal(sectionsToWrite(some, true).length, 12, "force writes all");
assert.equal(hasAnyContent(empty), false);
assert.equal(hasAnyContent(some), true);

assert.equal(deriveTitle("Aplikasi kasir\nuntuk warung"), "Aplikasi kasir");
assert.equal(deriveTitle("\n\n  Kasir  \n"), "Kasir");
assert.equal(deriveTitle("x".repeat(80)).length, 60, "capped");
console.log("prd.test OK");
