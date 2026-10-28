import assert from "node:assert";
import { PACKS, PACK_ORDER, buildPlanContext, buildPlanPrompt, buildSystemPrompt, buildValidationPrompt } from "../lib/prompts.ts";

assert.deepEqual(PACK_ORDER, ["prd", "brand", "design", "technical", "delivery"], "PACK_ORDER has 5 packs in authoring order");
assert.ok(PACKS.technical, "technical pack exists");
assert.ok(PACKS.delivery, "delivery pack exists");
assert.equal(PACKS.technical.file, "TECHNICAL.md");
assert.equal(PACKS.delivery.file, "DELIVERY.md");
assert.ok(PACKS.technical.sections.length >= 4, "technical has at least 4 sections");
assert.ok(PACKS.delivery.sections.length >= 2, "delivery has at least 2 sections");
assert.ok(PACKS.delivery.sections.some(s => s.key === "delivery.plan"), "delivery.plan section exists");
assert.ok(PACKS.delivery.sections.some(s => s.key === "delivery.dod"), "delivery.dod section exists");

const sys = buildSystemPrompt("prd", PACKS.prd.sections[0], "generate", "Test App", "");
assert.match(sys, /Write the complete section now/, "generate mode instructs immediate writing");
assert.match(sys, /do not ask questions/i, "generate mode says do not ask questions");

const valPrompt = buildValidationPrompt("## Introduction\nSome context here");
assert.match(valPrompt, /JSON/, "validation prompt asks for JSON");
assert.match(valPrompt, /contradiction/i, "validation prompt checks contradictions");

const brainstorm = buildSystemPrompt("prd", PACKS.prd.sections[0], "brainstorm", "Test App", "");
assert.match(brainstorm, /brainstorm/i, "brainstorm mode mentions brainstorm");
assert.match(brainstorm, /Do NOT write a <content>/i, "brainstorm mode forbids content blocks");
assert.ok(!brainstorm.includes("Write the complete section now"), "brainstorm mode does not instruct writing");

const planCtx = buildPlanContext([
  { key: "prd.introduction", content_md: "### Problem\nUsers can't write specs." },
  { key: "prd.goals", content_md: "" },
]);
assert.match(planCtx, /Problem/, "plan context includes filled section content");
assert.match(planCtx, /Belum diisi/, "plan context marks empty sections");
assert.match(planCtx, /Tujuan/i, "plan context includes empty section title");

const planPrompt = buildPlanPrompt(planCtx);
assert.match(planPrompt, /JSON/, "plan prompt asks for JSON");
assert.match(planPrompt, /nextSection/i, "plan prompt asks for nextSection");
assert.match(planPrompt, /suggestedOrder/i, "plan prompt asks for suggestedOrder");

console.log("prompts.test OK");
