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

/** Render all packs in authoring order (currently just PRD). */
export function renderBundle(
  sections: SectionContent[],
  projectTitle: string,
): { file: string; content: string }[] {
  return PACK_ORDER.map((packId) => ({
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
    `You are implementing the product documented in \`PRD.md\` (in this repo/bundle). Read it before writing any code, then follow the rules below.`,
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
    sectionBody(sections, "prd.dod", `- Acceptance scenarios from the PRD pass.\n- Core logic has tests that fail before the fix and pass after.\n- Lint and typecheck are clean.\n- Accessibility basics hold: labels, keyboard, focus visible.`),
    ``,
    `## How to work`,
    ``,
    `### 1. Understand before you build`,
    `- Restate the feature in one sentence and list your assumptions. If a requirement is ambiguous, ask — do not guess.`,
    `- Read the existing code first: match its structure, naming, and style. Consistency beats personal preference.`,
    `- For anything non-trivial, write a short plan first (what changes, why, the steps, how you will test it). Skip planning only for genuinely trivial edits.`,
    `- Find the smallest vertical slice that delivers real user value. Build one slice at a time, verify it, then move to the next.`,
    ``,
    `### 2. Build it test-first`,
    `- Test-first for non-trivial logic: red → green → refactor. Every non-trivial piece ships with a runnable check.`,
    `- Make the failing test fail for the right reason before you make it pass.`,
    ``,
    `### 3. Debug by root cause, never by guess`,
    `- When something breaks — a test, a build, behaviour, a performance problem — investigate the root cause before changing anything. A symptom fix is a failure.`,
    `- Reproduce it first with a failing test or a minimal, repeatable command. If you cannot reproduce it, you do not yet understand it.`,
    `- Fix the cause, then re-run the reproduction to prove it is fixed.`,
    ``,
    `### 4. Keep it simple`,
    `- No speculative abstractions, no config for values that never change, no scaffolding "for later". Fewest files, shortest working diff. Deletion over addition.`,
    `- Prefer the standard library and platform features. Adding a dependency needs a reason that a few lines of code cannot satisfy.`,
    `- If you simplify something deliberately, leave a \`ponytail:\` comment naming the ceiling and the upgrade path.`,
    `- Never simplify away: input validation at trust boundaries, error handling that prevents data loss, security, accessibility.`,
    ``,
    `### 5. Handle failure and data with care`,
    `- Validate every external input at the trust boundary; fail loudly with a clear message, never silently.`,
    `- Never lose or corrupt user data: make writes atomic where it matters, back up before destructive work, and prefer reversible operations.`,
    `- Build the error paths, not just the happy path — empty, loading, error, and permission-denied states are part of the feature.`,
    ``,
    `### 6. Treat security as a requirement`,
    `- Never hardcode secrets, tokens, or credentials; keep them in environment variables or a secret store.`,
    `- Authenticate and authorize every sensitive operation — check ownership, not just identity.`,
    `- Parameterize queries, escape output you render, and never trust client-supplied ids, roles, or prices.`,
    ``,
    `### 7. Verify before you claim done`,
    `- Evidence before claims: run the real command (tests, lint, typecheck, build), read the full output, then say whether it passed.`,
    `- Never claim a task is "done", "fixed", or "passing" from memory or from an earlier run — re-run it against the current code first.`,
    ``,
    `### 8. Commit and review cleanly`,
    `- Make small, focused commits that each do one thing; never commit secrets, build output, or generated junk.`,
    `- Do not rewrite history others may have, and do not force-push shared branches.`,
    `- Before merging a feature, review your own diff against the PRD: does it do what was asked, and nothing extra?`,
    ``,
    `### If the product has a user interface`,
    `- Accessibility is a requirement, not decoration: 4.5:1 contrast minimum, full keyboard navigation, visible focus states, respect \`prefers-reduced-motion\`.`,
    `- Responsive at 375px, 768px, 1024px, 1440px. No horizontal scroll on mobile.`,
    `- Design every state: default, loading, empty, error, success.`,
    `- Use one consistent icon set (e.g. Lucide). Never emoji as icons.`,
    `- Do not invent a visual style — follow the direction in the PRD or ask.`,
    ``,
    `### Product copy`,
    `- Write specific, concrete user-facing copy — no generic filler, no placeholder text.`,
    `- Match the tone in the PRD, and keep quoted product strings verbatim.`,
    ``,
    `## Anti-slop filter`,
    ``,
    `- No placeholder content: no lorem ipsum, no stub features, no fake data in product paths.`,
    `- No boilerplate "for later", no interfaces with one implementation, no factories with one product.`,
    `- No AI tells in prose: no "not X but Y" padding, no forced triads, no closers that add nothing.`,
    `- If your output looks sterile, the missing piece is direction — re-read the PRD, do not add more code.`,
    ``,
    `## Review gate (before declaring done)`,
    ``,
    `1. Run the Definition of Done checklist for the feature, and show the evidence.`,
    `2. Re-read the PRD acceptance scenarios for it and verify each one against the running product.`,
    `3. Self-review the diff: anything you added that the PRD does not ask for? Remove it or justify it.`,
    `4. Confirm the security and data-loss rules above still hold for the change.`,
  ].join("\n");
}

/** Static human guide shipped inside the ZIP (Indonesian, for the product owner). */
export const CARA_PAKAI_MD = `# CARA_PAKAI.md: Panduan memakai hasil Specly

Dokumen ini untuk KAMU (pemilik produk). File AGENTS.md di sebelahnya untuk AI coding agent,
kamu tidak perlu membacanya.

> **Cek dulu bagian bertanda \`[ASSUMPTION: …]\`.** PRD ini disusun dari obrolan singkat di Specly:
> kamu menceritakan idemu, lalu AI menanyakan beberapa hal yang belum jelas. Pertanyaan yang kamu
> lewati diisi dengan pilihan umum untuk jenis aplikasimu. Bila ada yang tidak cocok, ubah di
> Specly lalu unduh ulang sebelum menyerahkan dokumen ke agent.

## 1. Taruh file di folder proyek

Extract ZIP ini, lalu taruh semua file (PRD.md, AGENTS.md) di folder utama (root) proyekmu,
sejajar dengan kode aplikasinya.

## 2. Buka AI coding agent di folder itu

- **Claude Code / Cursor / Codex**: buka folder proyek dengan tool tersebut. Mereka otomatis
  membaca AGENTS.md, tidak perlu kamu perintahkan apa-apa selain fitur yang mau dibangun.
- **Chat web (ChatGPT, Claude, dll)**: lampirkan semua file, lalu bilang:
  "Baca AGENTS.md dulu, lalu bangun sesuai PRD."

## 3. Minta satu fitur dulu, jangan semuanya sekaligus

Contoh: "Bangun FR-1 dulu sampai lulus kriteria terimanya." Setelah selesai dan kamu cek,
lanjut fitur berikut. Agent bekerja jauh lebih akurat dengan irisan kecil.

## 4. Kalau hasilnya meleset, tunjuk ke dokumen

Jangan debat dengan agent. Tunjuk pasalnya: "Sesuai FR-3, contohnya ada di bagian
Skenario Penerimaan." Dokumen adalah sumber kebenaran.

## 5. Kalau kebutuhanmu berubah, ubah di Specly

Perbarui bagian terkait di Specly, unduh ulang, ganti file di folder proyek, lalu beri tahu
agent: "PRD berubah, baca ulang AGENTS.md." Jangan biarkan agent menebak perubahan dari
percakapan lama.
`;

