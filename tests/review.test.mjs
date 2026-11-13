import assert from "node:assert";
import {
  parseReview,
  collectIds,
  verifyFix,
  routeFinding,
  planReview,
  escalationToDecision,
} from "../lib/review.ts";

// --- parseReview: tolerant, never throws (Review Focus 1, 3) ---
assert.deepEqual(parseReview("no json here"), { findings: [] });
assert.deepEqual(parseReview('```json\n{"findings":[]}\n```'), { findings: [] });
const one = parseReview('{"findings":[{"section":"prd.entities","weight":"high","issue":"x"}]}');
assert.equal(one.findings.length, 1);
assert.equal(one.findings[0].weight, "high");
// unknown weight coerces to low; a non-array findings field is empty
assert.equal(parseReview('{"findings":[{"section":"a","weight":"weird","issue":"i"}]}').findings[0].weight, "low");
assert.deepEqual(parseReview('{"findings":"nope"}'), { findings: [] });

// --- collectIds ---
assert.deepEqual(collectIds("US-1 FR-2 AS-3 NFR-4"), ["US-1", "FR-2", "AS-3", "NFR-4"]);
assert.deepEqual(collectIds("nothing"), []);

// --- verifyFix: Tier 1 rename keeps IDs + heading ---
const beforeRename = "### Key Entities\n| Entity | Notes |\n| Item | x |\n- FR-1 uses Item";
const rename = {
  section: "prd.entities",
  weight: "low",
  issue: "canonical name",
  rule: "canonical name: Produk",
  from: "Item",
  to: "Produk",
  revisedContent: "### Key Entities\n| Entity | Notes |\n| Produk | x |\n- FR-1 uses Produk",
};
assert.equal(verifyFix(rename, beforeRename, "Key Entities"), true);
// dropped ID is rejected (Review Focus 2)
assert.equal(
  verifyFix({ ...rename, revisedContent: "### Key Entities\n| Produk | x |" }, beforeRename, "Key Entities"),
  false,
);
// changed heading is rejected
assert.equal(
  verifyFix({ ...rename, revisedContent: "### Entities\n| Produk | x |\n- FR-1" }, beforeRename, "Key Entities"),
  false,
);
// empty / unchanged content is rejected
assert.equal(verifyFix({ ...rename, revisedContent: "" }, beforeRename, "Key Entities"), false);
assert.equal(verifyFix({ ...rename, revisedContent: beforeRename }, beforeRename, "Key Entities"), false);
// canonical term must appear when the rule cites one
assert.equal(
  verifyFix({ ...rename, revisedContent: "### Key Entities\n| Item | x |\n- FR-1" }, beforeRename, "Key Entities"),
  false,
);

// --- verifyFix: Tier 2 removal must declare removed + rule ---
const beforeDrop = "### Goals\n### Non-Goals\n- offline\n### Functional Requirements\n- FR-1 online\n- FR-2 offline mode";
const drop = {
  section: "prd.functional",
  weight: "high",
  issue: "FR-2 restates a Non-Goal",
  rule: "Non-Goal: offline",
  removed: "- FR-2 offline mode",
  revisedContent: "### Functional Requirements\n- FR-1 online",
};
assert.equal(verifyFix(drop, beforeDrop, "Functional Requirements"), true, "removal with removed+rule drops FR-2");
assert.equal(verifyFix({ ...drop, removed: "" }, beforeDrop, "Functional Requirements"), false, "no removed => reject");
assert.equal(verifyFix({ ...drop, rule: "" }, beforeDrop, "Functional Requirements"), false, "no rule => reject");
assert.equal(
  verifyFix({ ...drop, revisedContent: beforeDrop }, beforeDrop, "Functional Requirements"),
  false,
  "removed text still present => reject",
);

// --- routeFinding ---
assert.equal(routeFinding(rename, beforeRename, "Key Entities").kind, "fix");
assert.equal(routeFinding({ section: "s", weight: "high", issue: "i" }, "x", "T").kind, "note", "high w/o options => note");
assert.equal(
  routeFinding({ section: "s", weight: "high", issue: "i", options: ["a", "b"] }, "x", "T").kind,
  "escalation",
);
assert.equal(routeFinding({ section: "s", weight: "medium", issue: "i", options: ["a"] }, "x", "T").kind, "note");
assert.equal(routeFinding({ section: "s", weight: "low", issue: "i" }, "x", "T").kind, "note");

// --- planReview: unknown section key is a note, not a fix (Review Focus 3) ---
const sections = [{ key: "prd.entities", content_md: beforeRename }];
const plan = planReview([rename, { section: "prd.nope", weight: "high", issue: "i" }], sections);
assert.equal(plan.fixes.length, 1);
assert.equal(plan.fixes[0].key, "prd.entities");
assert.equal(plan.fixes[0].before, beforeRename);
assert.equal(plan.notes.length, 1);

// --- planReview: two fixes for one key dedupe last-wins ---
const second = {
  ...rename,
  issue: "second finding",
  revisedContent: "### Key Entities\n| Produk | y |\n- FR-1 uses Produk",
};
const dedup = planReview([rename, second], sections);
assert.equal(dedup.fixes.length, 1, "one fix per section key");
assert.equal(dedup.fixes[0].finding.issue, "second finding", "later finding replaces the earlier");

// --- escalationToDecision ---
const dec = escalationToDecision(
  { section: "prd.functional", weight: "high", issue: "offline?", options: ["online only", "offline too"], recommended: "online only" },
  "R1",
);
assert.equal(dec.id, "R1");
assert.equal(dec.question, "offline?");
assert.equal(dec.options[0], "online only");
assert.equal(dec.recommended, "online only");
assert.equal(dec.chosen, "online only");

console.log("review.test OK");
