import assert from "node:assert";
import { renderBundle, renderPack } from "../lib/render.ts";

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
  ["PRD.md", "DESIGN_PACK.md", "BRAND_PACK.md"],
  "bundle order: PRD, Design, Brand",
);
assert.match(bundle[2].content, /## Voice and Tone\n\nFriendly\./, "brand content lands in its doc");
assert.equal(bundle[2].content.includes("## Introduction"), false, "no PRD sections leak into brand doc");

console.log("render.test OK");
