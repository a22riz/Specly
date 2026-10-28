import assert from "node:assert";
import { CARA_PAKAI_MD, renderAgentOnboarding, renderBundle, renderPack } from "../lib/render.ts";

const sections = [
  { key: "prd.introduction", content_md: "### Problem\nUsers cannot write specs." },
  { key: "prd.goals", content_md: "### Goals\n- Ship fast" },
  { key: "brand.voice", content_md: "Friendly." },
];

const prd = renderPack("prd", sections, "Todo App");
assert.match(prd, /^# Todo App — Product Requirements Document/);
assert.match(prd, /## Introduction\n\n### Problem\nUsers cannot write specs\./);
assert.match(prd, /## User Stories\n\n_Belum diisi\._/, "empty section placeholder");
assert.match(prd, /## Technical Constraints\n\n_Belum diisi\._/, "new constraints section renders");

const bundle = renderBundle(sections, "Todo App");
assert.deepEqual(
  bundle.map((b) => b.file),
  ["PRD.md", "BRAND_PACK.md", "DESIGN_PACK.md", "TECHNICAL.md", "DELIVERY.md"],
  "bundle order follows authoring flow: PRD, Brand, Design, Technical, Delivery",
);
assert.match(bundle[1].content, /## Voice and Tone\n\nFriendly\./, "brand content lands in its doc");
assert.equal(bundle[1].content.includes("## Introduction"), false, "no PRD sections leak into brand doc");

const onboarding = renderAgentOnboarding(sections, "Todo App");
assert.match(onboarding, /^# AGENTS\.md — Building "Todo App"/);
assert.match(onboarding, /### Goals\n- Ship fast/, "goals section quoted verbatim");
assert.match(onboarding, /confirm the stack with the product owner/, "default fallback when constraints empty");
assert.match(CARA_PAKAI_MD, /CARA_PAKAI\.md/, "human guide present");

// --- Task 2: DoD fallback + new pack files in guide ---

const dodSections = [
  { key: "prd.dod", content_md: "### PRD DoD\n- Basic checklist" },
  { key: "delivery.dod", content_md: "### Delivery DoD\n- Enhanced checklist" },
];
const onbWithBoth = renderAgentOnboarding(dodSections, "Todo App");
assert.match(onbWithBoth, /Enhanced checklist/, "uses delivery.dod when present");
assert.equal(onbWithBoth.includes("Basic checklist"), false, "does not show prd.dod when delivery.dod exists");

const onbWithPrdOnly = renderAgentOnboarding([{ key: "prd.dod", content_md: "### PRD DoD\n- Basic only" }], "Todo App");
assert.match(onbWithPrdOnly, /Basic only/, "falls back to prd.dod when delivery.dod absent");

assert.match(CARA_PAKAI_MD, /TECHNICAL\.md/, "human guide mentions TECHNICAL.md");
assert.match(CARA_PAKAI_MD, /DELIVERY\.md/, "human guide mentions DELIVERY.md");

console.log("render.test OK");
