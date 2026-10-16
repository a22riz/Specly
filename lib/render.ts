import { PACK_ORDER, PACKS } from "./prompts.ts";
import type { PackId, PackDef, SectionDef } from "./prompts.ts";

export type SectionContent = { key: string; content_md: string };

/** Render one pack into a complete Markdown document. */
export function renderPack(packId: PackId, sections: SectionContent[], projectTitle: string): string {
  const pack: PackDef = PACKS[packId];
  const parts: string[] = [`# ${projectTitle} — ${pack.docTitle}`];
  for (const section of pack.sections) {
    parts.push(renderSection(section, sections));
  }
  return parts.join("\n\n") + "\n";
}

function renderSection(section: SectionDef, sections: SectionContent[]): string {
  const content = sections.find((s) => s.key === section.key)?.content_md.trim();
  const body = content || "_Belum diisi._";
  return `## ${section.enTitle}\n\n${body}`;
}

/** Render all packs. Order: PRD first, then Design, then Brand. */
export function renderBundle(
  sections: SectionContent[],
  projectTitle: string,
): { file: string; content: string }[] {
  return [...PACK_ORDER].reverse().map((packId) => ({
    file: PACKS[packId].file,
    content: renderPack(packId, sections, projectTitle),
  }));
}

function sectionBody(sections: SectionContent[], key: string, fallback: string): string {
  const content = sections.find((s) => s.key === key)?.content_md.trim();
  if (!content || content === "_Belum diisi._") return fallback;
  return content;
}

/**
 * AGENTS.md for the target coding agent — assembled from the project's own
 * sections plus fixed working rules. Named AGENTS.md because Claude Code,
 * Cursor, and Codex pick it up automatically at the repo root.
 */
export function renderAgentOnboarding(sections: SectionContent[], projectTitle: string): string {
  return [
    `# AGENTS.md — Building "${projectTitle}"`,
    ``,
    `You are implementing the product documented in the companion files: \`PRD.md\`, \`DESIGN_PACK.md\`, \`BRAND_PACK.md\` (all in this repo/bundle). Read them in that order before writing any code, then follow the rules below.`,
    ``,
    `## Product boundaries (from the PRD — hard limits, do not cross)`,
    ``,
    sectionBody(
      sections,
      "prd.constraints",
      `_None recorded. Before choosing any library or service, confirm the stack with the product owner — do not assume._`,
    ),
    ``,
    `## Non-goals (explicitly out of scope — do not build these)`,
    ``,
    sectionBody(
      sections,
      "prd.goals",
      `_None recorded. If you find yourself building something the PRD does not mention, stop and ask._`,
    ),
    ``,
    `## Definition of Done (apply to every feature)`,
    ``,
    sectionBody(
      sections,
      "prd.dod",
      `- Acceptance scenarios from the PRD pass.\n- Core logic has tests that fail before the fix and pass after.\n- Lint and typecheck are clean.\n- Accessibility basics hold: labels, keyboard, focus visible.`,
    ),
    ``,
    `## Known pitfalls`,
    ``,
    sectionBody(
      sections,
      "prd.pitfalls",
      `_None recorded in the PRD. Watch for the classics anyway: invented requirements, wrong data assumptions, ignoring empty/loading/error states._`,
    ),
    ``,
    `## Working practices`,
    ``,
    `### Before coding`,
    `- Restate the feature in one sentence and list your assumptions. If a requirement is ambiguous, ask — do not guess.`,
    `- Find the smallest vertical slice that delivers user value. Build one slice at a time, verify it, then move on.`,
    `- Read the existing code first: match its structure, naming, and style. Consistency beats personal preference.`,
    ``,
    `### While coding`,
    `- Test-first for non-trivial logic: red, green, refactor. Every non-trivial piece ships with a runnable check.`,
    `- No speculative abstractions, no config for values that never change, no scaffolding "for later". Fewest files, shortest working diff. Deletion over addition.`,
    `- If you simplify something deliberately, leave a \`ponytail:\` comment naming the ceiling and the upgrade path.`,
    `- Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security, accessibility.`,
    ``,
    `### UI work`,
    `- Follow \`DESIGN_PACK.md\` tokens exactly (colors, type scale, spacing, radius). Do not invent new palette values.`,
    `- Accessibility is a requirement, not decoration: 4.5:1 contrast minimum, full keyboard navigation, visible focus states, respect \`prefers-reduced-motion\`.`,
    `- Responsive at 375px, 768px, 1024px, 1440px. No horizontal scroll on mobile.`,
    `- Icons from one consistent set (e.g. Lucide). Never emoji as icons.`,
    ``,
    `### Product copy`,
    ``,
    `- Follow \`BRAND_PACK.md\` voice & tone for every user-facing string. Write specific, concrete copy — no generic filler.`,
    ``,
    `## Anti-slop filter`,
    ``,
    `- No placeholder content: no lorem ipsum, no stub features, no fake data in product paths.`,
    `- No boilerplate "for later", no interfaces with one implementation, no factories with one product.`,
    `- If your output looks sterile, the missing piece is direction — re-read the brand and design packs, do not add more code.`,
    ``,
    `## Review gate (before declaring done)`,
    ``,
    `1. Run the Definition of Done checklist for the feature.`,
    `2. Re-read the PRD acceptance scenarios for it and verify each one manually.`,
    `3. Self-review the diff: anything you added that the PRD does not ask for? Remove it or justify it.`,
  ].join("\n");
}
