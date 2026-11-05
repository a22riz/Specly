import assert from "node:assert";
import { PACK_ORDER, PRD_SECTIONS, buildExplorePrompt, buildPrdContext, buildPlanPrompt, buildSectionFromPlanPrompt, buildRefinePrompt } from "../lib/prompts.ts";
import { parsePlan } from "../lib/plan.ts";

assert.deepEqual(PACK_ORDER, ["prd"], "single prd pack");
assert.equal(PRD_SECTIONS.length, 12, "12 PRD sections");
assert.deepEqual(PRD_SECTIONS.map((s) => s.key), [
  "prd.overview","prd.goals","prd.stories","prd.acceptance","prd.functional",
  "prd.entities","prd.edgecases","prd.nonfunctional","prd.constraints",
  "prd.glossary","prd.success","prd.dod",
], "section keys and order");

const explore = buildExplorePrompt("Todo", "");
assert.match(explore, /Indonesian/, "explore talks in Indonesian");
assert.match(explore, /do not write/i, "explore never writes content");
assert.equal(explore.includes("<content>"), false, "explore forbids content blocks");
assert.match(explore, /App Playbook/, "explore reasons from the category playbook");
assert.match(explore, /PROPOSE|recommend/i, "explore leads with recommendations");

const minimalPlanJson = "{}";
const sec = buildSectionFromPlanPrompt(PRD_SECTIONS[0], "Warung", parsePlan(minimalPlanJson), "kasir");
assert.match(sec, /<content>/, "section emits one content block");
assert.match(sec, /ASSUMPTION/, "section fills gaps with labeled assumptions");
assert.match(sec, /ENGLISH/, "section content is English");
assert.match(sec, /### Overview/, "uses the section enTitle");
const ref = buildRefinePrompt(PRD_SECTIONS[0], "Warung", parsePlan(minimalPlanJson), "### Overview\nold", "tambah target user");
assert.match(ref, /<content>/, "refine emits one content block");
assert.match(ref, /tambah target user/, "refine carries the instruction");

const ctx = buildPrdContext([{ key: "prd.overview", content_md: "### Problem\nX" }, { key: "prd.goals", content_md: "" }]);
assert.match(ctx, /X/, "context includes filled content");
assert.match(ctx, /Belum diisi/, "context marks empty sections");

const plan = buildPlanPrompt("Warung", "aplikasi kasir untuk warung kopi");
assert.match(plan, /App Playbook/, "plan prompt carries the playbook");
assert.match(plan, /JSON/, "plan prompt demands JSON");
for (const s of PRD_SECTIONS) assert.ok(plan.includes(s.key), `plan prompt lists ${s.key}`);
console.log("prompts.test OK");
