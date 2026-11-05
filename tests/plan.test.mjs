import assert from "node:assert";
import { parsePlan, minimalPlan, planText } from "../lib/plan.ts";

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
// a chosen value not in options is normalized to recommended
const bad = JSON.stringify({ ...JSON.parse(valid), decisions: [{ id: "x", label: "L", question: "Q", recommended: "R", options: ["R"], chosen: "Z" }] });
assert.equal(parsePlan(bad).decisions[0].chosen, "R");
assert.match(planText(parsePlan(valid)), /Pembayaran/, "renders decisions");
console.log("plan.test OK");
