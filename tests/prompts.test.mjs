import assert from "node:assert";
import { PACK_ORDER, PRD_SECTIONS, buildDiscoveryPrompt, buildPrdContext, buildPlanPrompt, buildSectionFromPlanPrompt, buildRefinePrompt, buildDecisionsRefinePrompt } from "../lib/prompts.ts";
import { parsePlan } from "../lib/plan.ts";

assert.deepEqual(PACK_ORDER, ["prd"], "single prd pack");
assert.equal(PRD_SECTIONS.length, 12, "12 PRD sections");
assert.deepEqual(PRD_SECTIONS.map((s) => s.key), [
  "prd.overview","prd.goals","prd.stories","prd.acceptance","prd.functional",
  "prd.entities","prd.edgecases","prd.nonfunctional","prd.constraints",
  "prd.glossary","prd.success","prd.dod",
], "section keys and order");

const explore = buildDiscoveryPrompt("Todo", "", 0, 8);
assert.match(explore, /Indonesian/, "explore talks in Indonesian");
assert.match(explore, /do not write/i, "explore never writes content");
assert.equal(explore.includes("<content>"), false, "explore forbids content blocks");
assert.match(explore, /App Playbook/, "explore reasons from the category playbook");
assert.match(explore, /PROPOSE|recommend/i, "explore leads with recommendations");

const dp = buildDiscoveryPrompt("Kasir", "", 0, 8);
assert.match(dp, /JSON/);
assert.match(dp, /"options"/);
assert.match(dp, /"done"/);
assert.match(dp, /rekomendasi/i);
assert.match(dp, /8/);
// Depth floor + coverage checklist: the model must not finish after one question.
assert.match(dp, /at least 4/i, "discovery states a minimum number of questions");
assert.match(dp, /coverage checklist/i, "discovery carries a coverage checklist");
for (const item of [/platform/i, /entit/i, /pric|money|payment|pajak/i, /offline/i, /notif/i, /privac/i]) {
  assert.match(dp, item, `discovery checklist covers ${item}`);
}

const minimalPlanJson = "{}";
const sec = buildSectionFromPlanPrompt(PRD_SECTIONS[0], "Warung", parsePlan(minimalPlanJson), "kasir");
assert.match(sec, /<content>/, "section emits one content block");
assert.match(sec, /ASSUMPTION/, "section fills gaps with labeled assumptions");
assert.match(sec, /ENGLISH/, "section content is English");
assert.match(sec, /### Overview/, "uses the section enTitle");
const ref = buildRefinePrompt(PRD_SECTIONS[0], "Warung", parsePlan(minimalPlanJson), "### Overview\nold", "tambah target user");
assert.match(ref, /<content>/, "refine emits one content block");
assert.match(ref, /tambah target user/, "refine carries the instruction");

// Cross-section consistency: canonical names + anti-conflict rules reach both prompts.
for (const p of [sec, ref]) {
  assert.match(p, /Terminology|canonical name/i, "prompt points at the canonical terminology");
  assert.match(p, /synonym/i, "prompt forbids alternate names for an entity/role");
  assert.match(p, /Non-Goals must not overlap|must not overlap/i, "prompt keeps Goals and Non-Goals disjoint");
  assert.match(p, /functional requirement/i, "prompt ties stories to functional requirements");
}

const ctx = buildPrdContext([{ key: "prd.overview", content_md: "### Problem\nX" }, { key: "prd.goals", content_md: "" }]);
assert.match(ctx, /X/, "context includes filled content");
assert.match(ctx, /Belum diisi/, "context marks empty sections");

const plan = buildPlanPrompt("Warung", "aplikasi kasir untuk warung kopi");
assert.match(plan, /App Playbook/, "plan prompt carries the playbook");
assert.match(plan, /JSON/, "plan prompt demands JSON");
for (const s of PRD_SECTIONS) assert.ok(plan.includes(s.key), `plan prompt lists ${s.key}`);
assert.match(plan, /"chosen"/, "plan prompt asks for a chosen value per decision");
assert.match(plan, /user actually picked/i, "plan prompt tells the model to mirror the user's choice");
assert.match(plan, /"terminology"/, "plan prompt asks for canonical terminology");
assert.match(plan, /"entities"/, "terminology lists canonical entities");
assert.match(plan, /"roles"/, "terminology lists canonical roles");
assert.match(plan, /"glossary"/, "terminology carries a glossary");

const dr = buildDecisionsRefinePrompt(
  "Decisions:\n- Pembayaran — chosen: Transfer (recommended: Transfer; options: Transfer, QRIS)",
  "jadikan QRIS",
);
assert.match(dr, /decisions/);
assert.match(dr, /jadikan QRIS/);
assert.match(dr, /"id"/);
assert.match(dr, /Pembayaran/);
console.log("prompts.test OK");
