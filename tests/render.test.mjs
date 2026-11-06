import assert from "node:assert";
import { CARA_PAKAI_MD, renderAgentOnboarding, renderBundle, renderPack } from "../lib/render.ts";

const sections = [
  { key: "prd.overview", content_md: "### Problem\nUsers cannot write specs." },
  { key: "prd.goals", content_md: "### Goals\n- Ship fast" },
  { key: "prd.constraints", content_md: "### Constraints\n- Must run offline" },
];

const prd = renderPack("prd", sections, "Todo App");
assert.match(prd, /^# Todo App — Product Requirements Document/);
assert.match(prd, /## Overview\n\n### Problem\nUsers cannot write specs\./);
assert.match(prd, /## User Stories\n\n_Belum diisi\._/, "empty section placeholder");
assert.match(prd, /## Constraints and Assumptions\n\n### Constraints\n- Must run offline/, "constraints section renders");

// --- Task 6: single PRD.md bundle ---
const bundle = renderBundle(sections, "Todo App");
assert.deepEqual(
  bundle.map((b) => b.file),
  ["PRD.md"],
  "single PRD file",
);

const onboarding = renderAgentOnboarding(sections, "Todo App");
assert.match(onboarding, /^# AGENTS\.md — Building "Todo App"/);
assert.match(onboarding, /PRD\.md/, "AGENTS.md points at PRD.md only");
assert.match(onboarding, /### Goals\n- Ship fast/, "goals section quoted verbatim");
assert.match(onboarding, /Must run offline/, "constraints section quoted verbatim");
assert.match(
  renderAgentOnboarding([], "Todo App"),
  /confirm the stack with the product owner/,
  "default fallback when constraints empty",
);
assert.equal(onboarding.includes("DESIGN_PACK.md"), false, "no stale pack references");
assert.equal(onboarding.includes("BRAND_PACK.md"), false, "no stale brand reference");
assert.equal(onboarding.includes("TECHNICAL.md"), false, "no stale technical reference");
assert.equal(onboarding.includes("DELIVERY.md"), false, "no stale delivery reference");

// --- best-practice rules distilled from the opencode skills ---
assert.match(onboarding, /root cause/i, "includes root-cause debugging rule");
assert.match(onboarding, /evidence before/i, "includes verify-before-completion rule");
assert.match(onboarding, /user data/i, "includes data-loss rule");
assert.match(onboarding, /secrets/i, "includes security rule");
assert.match(onboarding, /standard library/i, "includes dependency-discipline rule");

// --- Task 6: DoD sources only prd.dod (delivery pack removed) ---
const onbWithPrdDod = renderAgentOnboarding(
  [{ key: "prd.dod", content_md: "### PRD DoD\n- Basic only" }],
  "Todo App",
);
assert.match(onbWithPrdDod, /Basic only/, "uses prd.dod when present");
assert.match(
  renderAgentOnboarding([], "Todo App"),
  /fail before the fix/,
  "DoD fallback when prd.dod absent",
);

// --- Task 6: human guide lists PRD only ---
assert.match(CARA_PAKAI_MD, /CARA_PAKAI\.md/, "human guide present");
assert.match(CARA_PAKAI_MD, /PRD\.md/, "guide lists PRD.md");
assert.match(CARA_PAKAI_MD, /\[ASSUMPTION: …\]/, "guide tells the owner to review [ASSUMPTION] lines");
assert.equal(CARA_PAKAI_MD.includes("LOGO.svg"), false, "guide references no logo");
assert.equal(CARA_PAKAI_MD.includes("DESIGN_PACK.md"), false, "guide mentions PRD only");
assert.equal(CARA_PAKAI_MD.includes("TECHNICAL.md"), false, "guide mentions PRD only");
assert.equal(CARA_PAKAI_MD.includes("DELIVERY.md"), false, "guide mentions PRD only");
assert.equal(CARA_PAKAI_MD.includes("BRAND_PACK.md"), false, "guide mentions PRD only");

console.log("render.test OK");
