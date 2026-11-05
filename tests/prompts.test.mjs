import assert from "node:assert";
import { PACKS, PACK_ORDER, PRD_SECTIONS, buildExplorePrompt, buildWriteSectionPrompt, buildPrdContext } from "../lib/prompts.ts";

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

const write = buildWriteSectionPrompt(PRD_SECTIONS[0], "Todo", "", "user: a task app");
assert.match(write, /<content>/, "write emits one content block");
assert.match(write, /NEEDS CLARIFICATION/, "write marks unknowns");
assert.match(write, /Never invent/i, "write forbids invention");

const ctx = buildPrdContext([{ key: "prd.overview", content_md: "### Problem\nX" }, { key: "prd.goals", content_md: "" }]);
assert.match(ctx, /X/, "context includes filled content");
assert.match(ctx, /Belum diisi/, "context marks empty sections");
console.log("prompts.test OK");
