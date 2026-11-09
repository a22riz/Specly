# PRD-only Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Specly from a 5-pack blueprint generator into a chat-first tool where the user brainstorms with an AI agent and the agent writes one agent-executable PRD.

**Architecture:** Reuse the existing Next.js + SQLite + BYOK + streaming stack. Collapse `PACKS` to a single `prd` pack of 12 sections. Replace the per-section editor with one persisted conversation per project; an "explore" prompt drives gather+clarify, and a "write" action fills the 12 section rows (SSE, sequential, grounded in the conversation). Export becomes `PRD.md` + `AGENTS.md` + `CARA_PAKAI.md`.

**Tech Stack:** Next.js 16 App Router, better-sqlite3, `@ai-sdk/openai` Chat Completions, `@base-ui/react` + shadcn-ui, Tailwind 4. Tests: `node --experimental-strip-types tests/*.mjs` (assert-based, no framework).

**Spec:** `docs/superpowers/specs/2026-11-05-prd-only-pivot-design.md`

## Global Constraints

- Every query is scoped to `user_id` of the session user; project ownership checked before any read/write.
- BYOK; Chat Completions only (`provider.chat`), never `provider.responses`. No tool-calling dependency.
- Conversation with the user is Indonesian; document content inside `<content>` is English (quoted product UI strings stay verbatim).
- Never invent implementation details (frameworks, APIs) in document content; emit `[NEEDS CLARIFICATION: …]` for unknowns.
- `sections` keys stay free-form; existing key `brand.logo` and old pack rows are ignored on render, not migrated.
- No new runtime dependencies.
- `lib/prompts.ts` is the single source of truth for section and prompt definitions.
- Verify every task with: `npx tsc --noEmit` and the task's test file.

## Review Focus

- **Empty/insufficient conversation, write invoked anyway.** The agent must emit `[NEEDS CLARIFICATION: …]`, never fabricated requirements. Test in Task 3 (write-prompt) and Task 2 (extract).
- **User text that looks like a `<content>` block.** Extraction must take only the assistant's block, never the user's message. Test in Task 3.
- **Re-running write over an existing PRD.** Must confirm before overwriting and must not leave half-written rows on error. Test in Task 3 (`sectionsToWrite`) and handled in Task 5.
- **AI endpoint error mid-stream.** The user's message must already be persisted; no partial section is saved; a retry continues cleanly. Test in Task 4.
- **Reload mid-conversation.** Messages must restore in order with no duplicates. Test in Task 1.

---

### Task 1: Persist the conversation

**Files:**
- Modify: `lib/db.ts` (add `messages` table + helpers)
- Test: `tests/db-messages.test.mjs` (new)

**Interfaces:**
- Consumes: existing `getDb()`, `db.exec` schema block.
- Produces:
  - `type Message = { id: number; project_id: number; role: "user" | "assistant"; content: string; created_at: string }`
  - `getMessages(projectId: number): Message[]`
  - `addMessage(projectId: number, role: Message["role"], content: string): void`
  - `clearMessages(projectId: number): void`

- [ ] **Step 1: Write the failing test**

```js
// tests/db-messages.test.mjs
import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PRD_DB_PATH = join(mkdtempSync(join(tmpdir(), "specly-")), "t.sqlite");
const { getDb, getMessages, addMessage, clearMessages } = await import("../lib/db.ts");

const pid = getDb().prepare("INSERT INTO projects (user_id, title) VALUES (1, 'P')").run(1).lastInsertRowid;
const u2 = getDb().prepare("INSERT INTO projects (user_id, title) VALUES (1, 'Q')").run(1).lastInsertRowid;
addMessage(pid, "user", "halo");
addMessage(pid, "assistant", "hai");
addMessage(u2, "user", "lain");

const msgs = getMessages(pid);
assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant"], "ordered by id");
assert.equal(msgs[0].content, "halo", "content stored verbatim");
assert.equal(getMessages(u2).length, 1, "scoped by project");

clearMessages(pid);
assert.equal(getMessages(pid).length, 0, "cleared");
assert.equal(getMessages(u2).length, 1, "clear scoped");
console.log("db-messages.test OK");
```

Note: `users` FK is `ON DELETE CASCADE` and `foreign_keys = ON`; creating a project with `user_id = 1` requires a user row. Insert one with raw SQL in the test if the FK rejects (`INSERT INTO users (email, password_hash) VALUES ('t@t','x')`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/db-messages.test.mjs`
Expected: FAIL — `getMessages` is not a function.

- [ ] **Step 3: Implement**

Add to the `db.exec` schema block:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, id);
```

Add the `Message` type and `getMessages` (ordered `id`), `addMessage`, `clearMessages`. `getMessages`/`clearMessages` take `projectId`; ownership is checked by callers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/db-messages.test.mjs`
Expected: PASS (`db-messages.test OK`).

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts tests/db-messages.test.mjs
git commit -m "feat(db): persist conversation messages per project"
```

---

### Task 2: Collapse prompts to one PRD pack + skill prompts

**Files:**
- Modify: `lib/prompts.ts`
- Test: `tests/prompts.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `PACKS` with a single `prd` entry; `PACK_ORDER = ["prd"]`.
  - `PRD_SECTIONS: SectionDef[]` (12, order below).
  - `buildExplorePrompt(projectTitle: string, prdContextMd: string): string`
  - `buildWriteSectionPrompt(section: SectionDef, projectTitle: string, prdContextMd: string, conversationText: string): string`
  - `buildPrdContext(sections: { key: string; content_md: string }[]): string`
  - Removed: `buildValidationPrompt`, `buildPlanPrompt`, `buildPlanContext`, `buildLogoPrompt`, `buildLogoRevisePrompt`, `LOGO_KEY`, `buildContext`, `findSection`, the `"design"|"brand"|"technical"|"delivery"` packs, and `generate`/`suggest`/`refine`/`brainstorm` modes.

Sections (key | enTitle), in order: `prd.overview` Overview · `prd.goals` Goals and Non-Goals · `prd.stories` User Stories · `prd.acceptance` Acceptance Scenarios · `prd.functional` Functional Requirements · `prd.entities` Key Entities · `prd.edgecases` Edge Cases · `prd.nonfunctional` Non-Functional Requirements · `prd.constraints` Constraints and Assumptions · `prd.glossary` Glossary · `prd.success` Success Criteria · `prd.dod` Definition of Done and Build Order.

- [ ] **Step 1: Write the failing test**

```js
// tests/prompts.test.mjs (replace body)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `PRD_SECTIONS` undefined / `PACK_ORDER` is 5 packs.

- [ ] **Step 3: Implement**

Rewrite `lib/prompts.ts` to the single pack and three builders. `buildExplorePrompt`: system prompt instructing Indonesian conversation, ask in plain language, cover problem/users/goals/non-goals/stories/requirements/edge cases/constraints/glossary/success criteria; strictly no `<content>`. `buildWriteSectionPrompt`: same English/`<content>` rules as today plus `[NEEDS CLARIFICATION: …]` and "Never invent implementation details". `buildPrdContext`: like the old `buildPlanContext` (all 12, empty → `_Belum diisi._`). Give each of the 12 sections an `aiPrompt` adapted from the current PRD prompts (user stories keep Given/When/Then; functional keeps FR IDs).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.mjs
git commit -m "feat(prompts): single PRD pack + explore/write skill prompts"
```

---

### Task 3: Pure write-phase helpers

**Files:**
- Create: `lib/prd.ts`
- Test: `tests/prd.test.mjs` (new)

**Interfaces:**
- Consumes: `PRD_SECTIONS`, `SectionDef` from `lib/prompts.ts`; `Message` from `lib/db.ts`.
- Produces:
  - `extractContent(text: string): string | null` — the assistant's single `<content>…</content>` body, fences stripped, or `null`.
  - `conversationText(messages: Message[]): string` — `"user: …\n\nassistant: …"` joined; user text is quoted verbatim (never treated as a content block).
  - `sectionsToWrite(existing: { key: string; content_md: string }[]): SectionDef[]` — all 12 defs when any row is non-empty, else the empty ones (for first pass); returns in `PRD_SECTIONS` order.
  - `hasAnyContent(existing: { key: string; content_md: string }[]): boolean`.

- [ ] **Step 1: Write the failing test**

```js
// tests/prd.test.mjs
import assert from "node:assert";
import { extractContent, conversationText, sectionsToWrite, hasAnyContent } from "../lib/prd.ts";
import { PRD_SECTIONS } from "../lib/prompts.ts";

assert.equal(extractContent("hi\n<content>### Overview\nText</content>"), "### Overview\nText");
assert.equal(extractContent("<content>```md\nA\n```</content>"), "A", "strips code fence");
assert.equal(extractContent("no block here"), null);
// user paste must not be mistaken for the assistant's block
const msgs = [
  { id: 1, project_id: 1, role: "user", content: "<content>ignore me</content>", created_at: "" },
  { id: 2, project_id: 1, role: "assistant", content: "ok", created_at: "" },
];
assert.match(conversationText(msgs), /user: <content>ignore me<\/content>/, "user text verbatim");

const empty = PRD_SECTIONS.map((s) => ({ key: s.key, content_md: "" }));
assert.equal(sectionsToWrite(empty).length, 12, "writes all when empty");
assert.equal(sectionsToWrite(empty)[0].key, "prd.overview", "PRD order");
const some = empty.map((s, i) => (i === 0 ? { ...s, content_md: "x" } : s));
assert.equal(sectionsToWrite(some).length, 11, "writes only empty on first pass");
assert.equal(hasAnyContent(empty), false);
assert.equal(hasAnyContent(some), true);
console.log("prd.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: FAIL — cannot find module `../lib/prd.ts`.

- [ ] **Step 3: Implement**

`extractContent` reuses the regex/strip logic currently in `app/api/chat/route.ts` (lines 168–171) and `generate-all/route.ts` (line 90). `sectionsToWrite` first pass = empty-only; when `hasAnyContent` is true the caller confirms overwrite and uses all 12 (pass `force` to return all 12 — add `sectionsToWrite(existing, force = false)`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prd.ts tests/prd.test.mjs
git commit -m "feat(prd): pure write-phase helpers"
```

---

### Task 4: Conversational explore route

**Files:**
- Modify: `app/api/chat/route.ts`
- Test: covered by Task 3 helpers (route stays thin; no route-level test file).

**Interfaces:**
- Consumes: `getMessages`, `addMessage` (Task 1); `buildExplorePrompt`, `buildPrdContext` (Task 2).
- Produces: `POST /api/chat` accepting `{ projectId: number; message: string }`, returning a text stream. Persists the user message before streaming and the assistant reply on completion.

- [ ] **Step 1: Rework the route**

New body type `{ projectId: number; message: string }`. Flow: `getSessionUser()` → 401; load AI config → 400 if unset; `getProject` + ownership → 404; `addMessage(projectId, "user", message)`; build context from `getSections` via `buildPrdContext` and history via `getMessages`; system = `buildExplorePrompt(project.title, prdContext)`; `streamText` with messages mapped from history; on stream end `addMessage(projectId, "assistant", fullText)` (read via `result.text`); return `result.toTextStreamResponse()`. Wrap AI setup in try/catch returning 502 as today.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. Manual: with AI configured, one message round-trips and both messages appear in `getMessages`.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(chat): project-scoped explore conversation, persisted"
```

---

### Task 5: PRD write route (SSE) + remove obsolete routes

**Files:**
- Create: `app/api/prd/route.ts`
- Delete: `app/api/generate-all/`, `app/api/validate/`, `app/api/plan/`, `app/api/logo/`, `lib/generate.ts`, `lib/validate.ts`, `lib/plan.ts`
- Test: `tests/sse.test.mjs` (existing, unchanged) covers `parseSSERecords`; write orchestration is exercised by Task 3 helpers.

**Interfaces:**
- Consumes: `sectionsToWrite`, `extractContent`, `conversationText` (Task 3); `buildWriteSectionPrompt`, `PRD_SECTIONS` (Task 2); `getSections`, `saveSection`, `getMessages` (Task 1).
- Produces: `POST /api/prd` `{ projectId: number; force?: boolean }` → SSE stream with events `section_start {key,title}`, `chunk {text}`, `section_done {key}`, `error {key,message}`, `done {totalSections, written}`.

- [ ] **Step 1: Implement**

Read config + project ownership as in Task 4. `const existing = getSections(projectId)`. If `hasAnyContent(existing) && !force`, respond 409 `{ error: "PRD sudah ada — kirim force untuk menimpa" }`. Build `conversationText(getMessages(projectId))`. For each def in `sectionsToWrite(existing, force)`: emit `section_start`; `buildWriteSectionPrompt(def, project.title, buildPrdContext(current), convo)`; `streamText` with `abortSignal: request.signal`; accumulate, `extractContent`, `saveSection` + update in-memory map, emit `section_done`; on error emit `error` with the key and continue. Emit `done`. Mirror the existing `generate-all` SSE shape and the abort check `if (request.signal.aborted) break`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. Manual: `/api/prd` on a project with a conversation writes the 12 rows; a second call without `force` returns 409.

- [ ] **Step 3: Commit**

```bash
git add app/api/prd app/api/generate-all app/api/validate app/api/plan app/api/logo lib/generate.ts lib/validate.ts lib/plan.ts
git commit -m "feat(prd): SSE write route; drop validate/plan/logo/generate-all"
```

---

### Task 6: PRD-only render + export

**Files:**
- Modify: `lib/render.ts`, `app/api/export/route.ts`
- Modify: `tests/render.test.mjs`

**Interfaces:**
- Consumes: `PACKS` (single `prd`), `PRD_SECTIONS`.
- Produces: `renderBundle` → `[{ file: "PRD.md", content }]`; `renderAgentOnboarding` referencing only `PRD.md` and sourcing `prd.constraints` (constraints+assumptions) and `prd.dod`; `CARA_PAKAI_MD` listing only `PRD.md`.

- [ ] **Step 1: Update the test**

```js
// tests/render.test.mjs — key assertions
assert.deepEqual(renderBundle(sections, "Todo App").map((b) => b.file), ["PRD.md"], "single PRD file");
const onb = renderAgentOnboarding(sections, "Todo App");
assert.match(onb, /PRD\.md/, "AGENTS.md points at PRD.md only");
assert.equal(onb.includes("DESIGN_PACK.md"), false, "no stale pack references");
assert.equal(CARA_PAKAI_MD.includes("TECHNICAL.md"), false, "guide mentions PRD only");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/render.test.mjs`
Expected: FAIL — bundle still has 5 files.

- [ ] **Step 3: Implement**

`renderBundle` keeps iterating `PACK_ORDER` (now `["prd"]`). Rewrite `renderAgentOnboarding`: reading-order line mentions only `PRD.md`; sections read `prd.constraints` (fallback text kept) and `prd.dod` (fallback kept); drop `prd.pitfalls`, design/brand/technical/delivery references. Rewrite `CARA_PAKAI_MD` file list to `PRD.md`, `AGENTS.md`. In `app/api/export/route.ts`: drop the `LOGO_KEY`/logo branch and `renderPack` per-file branch (keep `file=onboarding` and the ZIP); ZIP = `PRD.md` + `AGENTS.md` + `CARA_PAKAI.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/render.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/render.ts app/api/export/route.ts tests/render.test.mjs
git commit -m "feat(export): single PRD.md bundle; AGENTS.md references PRD only"
```

---

### Task 7: Remove logo/brand UI

**Files:**
- Delete: `components/logo-card.tsx`, `components/brand-steps.tsx`
- Test: `npx tsc --noEmit` (no dangling imports)

- [ ] **Step 1: Delete both components and any imports of them** (grep first: `grep -rn "logo-card\|brand-steps" app components`).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A components
git commit -m "chore: remove logo and brand-steps UI"
```

---

### Task 8: Chat-first editor

**Files:**
- Modify: `app/projects/[id]/editor.tsx`
- Modify: `app/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `getMessages` (Task 1) on the server; `/api/chat` (Task 4); `/api/prd` (Task 5); `PRD_SECTIONS`; `saveSectionAction`.
- Produces: `Editor({ project, initialSections, initialMessages, aiReady })` — one conversation pane + a "Buat PRD" action + a PRD preview/edit pane.

- [ ] **Step 1: Implement the UI**

`page.tsx`: load `getMessages(project.id)` and pass `initialMessages`. `editor.tsx`: replace packs/tabs/section-chat/logo/validate/plan with: a conversation list (user + assistant bubbles) hydrated from `initialMessages`; an input that POSTs to `/api/chat` and streams `AiTyping`/text; a **Buat PRD** button that calls `/api/prd` and consumes SSE (`parseSSERecords`) into a 12-item progress list exactly like the old generate dialog (reuse `abortRef`, `AbortController`); on completion reload sections. If `hasAnyContent`, show a confirm dialog before calling with `force: true`. Below, a PRD preview: a section list (from `PRD_SECTIONS`) with a textarea per section saving via `saveSectionAction`, and the export buttons (`/api/export`, `file=onboarding` → AGENTS.md).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` and `npx eslint app/projects/[id]/editor.tsx app/projects/[id]/page.tsx`
Expected: clean. Manual: reload restores the conversation; Buat PRD fills the preview; editing a section persists.

- [ ] **Step 3: Commit**

```bash
git add app/projects app/api/prd
git commit -m "feat(editor): chat-first PRD editor"
```

---

### Task 9: Docs and copy

**Files:**
- Modify: `README.md`, `AGENTS.md`

- [ ] **Step 1: Update both** — README: describe PRD-only, one conversation, the 12 sections, export contents, and the new test file names. `AGENTS.md`: replace the pack/section description with the single `prd` pack + skill prompts, the `messages` table, and the removed routes.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && node --experimental-strip-types tests/prd.test.mjs && node --experimental-strip-types tests/prompts.test.mjs && node --experimental-strip-types tests/render.test.mjs && node --experimental-strip-types tests/db-messages.test.mjs && node --experimental-strip-types tests/auth.test.mjs`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: PRD-only pivot"
```
