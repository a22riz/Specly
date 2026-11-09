import assert from "node:assert";
import { parsePlan, minimalPlan, planText, mergeDecisions, normalizeDecisions } from "../lib/plan.ts";
import { PRD_SECTIONS, buildSectionFromPlanPrompt } from "../lib/prompts.ts";

const valid = JSON.stringify({
  category: "POS", industry: "ritel", scale: "small", platform: "web",
  decisions: [{ id: "payment", label: "Pembayaran", question: "Q?", recommended: "Tunai", options: ["Tunai", "QRIS"], chosen: "Tunai" }],
  assumptions: [{ id: "a1", label: "Pajak", note: "PB1 10%" }],
  outline: { "prd.overview": "problem" },
});
assert.equal(parsePlan(valid).category, "POS");
assert.equal(parsePlan("```json\n" + valid + "\n```").category, "POS", "strips fence");
assert.equal(parsePlan("here you go:\n" + valid + "\nthe end").category, "POS", "finds JSON in prose");
assert.doesNotThrow(() => parsePlan("not json at all"));
assert.equal(parsePlan("not json at all").category, minimalPlan().category, "falls back");
assert.equal(minimalPlan().decisions.length, 0);
assert.deepEqual(parsePlan(valid).decisions[0].options, ["Tunai", "QRIS"]);
// a non-empty chosen value is kept verbatim, even outside options
const bad = JSON.stringify({ ...JSON.parse(valid), decisions: [{ id: "x", label: "L", question: "Q", recommended: "R", options: ["R"], chosen: "Z" }] });
assert.equal(parsePlan(bad).decisions[0].chosen, "Z");
assert.match(planText(parsePlan(valid)), /Pembayaran/, "renders decisions");

// A chosen value that differs from the recommendation must reach the prompts,
// otherwise re-drafting after a chip change produces identical output.
const chosenDiff = JSON.stringify({
  ...JSON.parse(valid),
  decisions: [
    { id: "payment", label: "Pembayaran", question: "Q?", recommended: "Tunai", options: ["Tunai", "QRIS"], chosen: "QRIS" },
  ],
});
const parsedChosen = parsePlan(chosenDiff);
assert.equal(parsedChosen.decisions[0].chosen, "QRIS", "keeps a valid chosen value");
assert.match(planText(parsedChosen), /chosen: QRIS/, "planText renders the chosen value");
assert.match(
  buildSectionFromPlanPrompt(PRD_SECTIONS[0], "Warung", parsedChosen, "kasir"),
  /chosen: QRIS/,
  "section prompt carries the chosen value",
);
// A free-text chosen answer (not among options) must survive verbatim.
const custom = parsePlan(
  JSON.stringify({
    decisions: [
      {
        id: "pay",
        label: "Pembayaran",
        question: "Bagaimana pembayaran?",
        recommended: "Transfer",
        options: ["Transfer", "QRIS"],
        chosen: "Transfer + e-wallet",
      },
    ],
  }),
);
assert.equal(custom.decisions[0].chosen, "Transfer + e-wallet");

// mergeDecisions: stored order kept, matching ids replaced, new ids appended.
const base = parsePlan(
  JSON.stringify({
    decisions: [
      { id: "D1", label: "A", recommended: "x", options: ["x", "y"], chosen: "x" },
      { id: "D2", label: "B", recommended: "p", options: ["p", "q"], chosen: "p" },
    ],
  }),
);
const merged = mergeDecisions(base, [
  { id: "D1", label: "A", question: "", recommended: "x", options: ["x", "y"], chosen: "QRIS" },
]);
assert.equal(merged.decisions.length, 2);
assert.equal(merged.decisions.find((d) => d.id === "D1").chosen, "QRIS");
assert.equal(merged.decisions.find((d) => d.id === "D2").chosen, "p");

// A next entry with a new id is appended; stored length grows by one.
const appended = mergeDecisions(base, [
  { id: "D3", label: "C", question: "", recommended: "m", options: ["m", "n"], chosen: "m" },
]);
assert.equal(appended.decisions.length, base.decisions.length + 1);
assert.ok(appended.decisions.some((d) => d.id === "D3"), "new id appended");

// An empty next leaves every stored decision untouched.
const untouched = mergeDecisions(base, []);
assert.equal(untouched.decisions.length, base.decisions.length);
assert.equal(untouched.decisions.find((d) => d.id === "D1").chosen, "x");
assert.equal(untouched.decisions.find((d) => d.id === "D2").chosen, "p");

// normalizeDecisions: coercive, keeps only object entries that carry an id.
const norm = normalizeDecisions([
  { id: "k1", label: "L", options: ["a"] },
  { label: "no id" },
  "junk",
  null,
  { id: "", label: "blank id" },
]);
assert.equal(norm.length, 1, "keeps only id-bearing object entries");
assert.equal(norm[0].id, "k1");
assert.equal(norm[0].chosen, "", "missing chosen coerces to empty string");
assert.deepEqual(normalizeDecisions("not an array"), []);

console.log("plan.test OK");
