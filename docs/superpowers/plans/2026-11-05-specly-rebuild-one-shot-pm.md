# Specly Rebuild (One-Shot Domain PM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Specly's core experience so one free-text idea becomes a complete, domain-aware PRD in a single streaming pass, with uncertainties surfaced as one-click decisions instead of a questionnaire or a wall of forms.

**Architecture:** A two-phase write pipeline — one short LLM call produces a JSON *plan* (classification + outline + assumptions + decisions), then the 12 sections are drafted with bounded concurrency using the plan as the shared consistency anchor. Sections, decisions, and the plan persist in SQLite; the project page is document-first with a "Perlu keputusan" panel and a refinement chat.

**Tech Stack:** Next.js 16 App Router, React 19, SQLite (better-sqlite3), `@ai-sdk/openai` (`provider.chat`), SSE, Tailwind 4 + Base UI.

**Spec:** `docs/superpowers/specs/2026-11-05-specly-rebuild-one-shot-pm-design.md`

## Global Constraints

- Next.js 16 App Router, `output: "standalone"`; do not change deployment files.
- SQLite via better-sqlite3; DB path `PRD_DB_PATH` (tests set it to a temp file).
- LLM calls use `createOpenAI({ baseURL, apiKey }).chat(model)` only — OpenAI-compatible endpoints.
- UI/chat copy is **Indonesian**; document content inside `<content>` is **English**.
- Exactly one `<content>…</content>` block per section, parsed by `extractContent`.
- `lib/prompts.ts` stays the single source of truth for prompts; `APP_PLAYBOOK` is the knowledge base.
- No new runtime dependency. Pure helpers get a test file run with `node --experimental-strip-types`.
- Parallel draft concurrency default **4**.
- Verify every task with `npx tsc --noEmit` and `npx eslint <changed files>`.

## Review Focus

- **Malformed/short plan JSON** (model returns prose, fences, or truncation): `parsePlan` must never throw and the draft must still run from a minimal plan. → Task 1 test.
- **One section failing under concurrency** (429/500/timeout): must not abort the other 11; it ends as `error`, the run still emits `done`. → Task 5 (per-section try/catch) + Task 5 mapLimit test.
- **Duplicate auto-run** (project with existing content opened again): must NOT re-draft or clobber. → Task 8 `shouldAutoRun` test.
- **Client disconnect mid-draft**: sections already written stay saved; work stops; no partial `<content>` persisted. → Task 5 abort check.
- **Changing one decision** must rewrite only its affected section(s), never wipe unrelated sections. → Task 6 refine is single-key.

---

### Task 1: Plan types + tolerant parser

**Files:**
- Create: `lib/plan.ts`
- Test: `tests/plan.test.mjs`

**Interfaces:**
- Produces: `type Decision = { id: string; label: string; question: string; recommended: string; options: string[]; chosen: string }`
- Produces: `type Assumption = { id: string; label: string; note: string }`
- Produces: `type Plan = { category: string; industry: string; scale: string; platform: string; decisions: Decision[]; assumptions: Assumption[]; outline: Record<string, string> }`
- Produces: `parsePlan(raw: string): Plan`, `minimalPlan(): Plan`, `planText(plan: Plan): string`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert";
import { parsePlan, minimalPlan, planText } from "../lib/plan.ts";

const valid = JSON.stringify({
  category: "POS", industry: "ritel", scale: "small", platform: "web",
  decisions: [{ id: "payment", label: "Pembayaran", question: "Q?", recommended: "Tunai", options: ["Tunai", "QRIS"], chosen: "Tunai" }],
  assumptions: [{ id: "a1", label: "Pajak", note: "PB1 10%" }],
  outline: { "prd.overview": "problem" },
});
assert.equal(parsePlan(valid).category, "POS");
assert.equal(parsePlan("```json\n" + valid + "\n```").category, "POS", "strips fence");
assert.equal(parsePlan("here you go:\n" + valid + "\nthe end").category, "POS", "finds JSON in prose");
assert.doesNotThrow(() => parsePlan("not json at all"));
assert.equal(parsePlan("not json at all").category, minimalPlan().category, "falls back");
assert.equal(minimalPlan().decisions.length, 0);
assert.deepEqual(parsePlan(valid).decisions[0].options, ["Tunai", "QRIS"]);
// a chosen value not in options is normalized to recommended
const bad = JSON.stringify({ ...JSON.parse(valid), decisions: [{ id: "x", label: "L", question: "Q", recommended: "R", options: ["R"], chosen: "Z" }] });
assert.equal(parsePlan(bad).decisions[0].chosen, "R");
assert.match(planText(parsePlan(valid)), /Pembayaran/, "renders decisions");
console.log("plan.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/plan.test.mjs`
Expected: FAIL — cannot find module `../lib/plan.ts`.

- [ ] **Step 3: Implement `lib/plan.ts`**

Types above plus a tolerant parser: strip ```` ```json ```` fences, then try `JSON.parse(raw)`; on failure, extract the first `{ … }` balanced span and parse that; on failure return `minimalPlan()`. Normalize arrays with `?? []`, coerce `outline` entries with `String(...)`, force `chosen` into `options` (fallback `recommended`). `minimalPlan()` returns empty strings/arrays with `outline = {}`. `planText` renders category/industry/scale/platform, each decision (`label — recommended: X (options: …)`), each assumption, and the outline lines.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/plan.test.mjs`
Expected: `plan.test OK`

- [ ] **Step 5: Commit**

```bash
git add lib/plan.ts tests/plan.test.mjs
git commit -m "feat: plan types and tolerant JSON parser"
```

---

### Task 2: Plan persistence

**Files:**
- Modify: `lib/db.ts`
- Test: `tests/db-plan.test.mjs`

**Interfaces:**
- Consumes: `Plan`, `Decision` from `lib/plan.ts` (type-only import).
- Produces: `getPlan(projectId: number): Plan | null`, `savePlan(projectId: number, plan: Plan): void`, `setDecision(projectId: number, id: string, chosen: string): void`.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.PRD_DB_PATH = join(mkdtempSync(join(tmpdir(), "specly-")), "t.sqlite");
const { getDb, getPlan, savePlan, setDecision } = await import("../lib/db.ts");
getDb().prepare("INSERT INTO users (email, password_hash) VALUES ('t@t','x')").run();
const pid = getDb().prepare("INSERT INTO projects (user_id, title) VALUES (1,'P')").run().lastInsertRowid;

assert.equal(getPlan(pid), null, "null before save");
savePlan(pid, { category: "POS", industry: "ritel", scale: "s", platform: "web",
  decisions: [{ id: "payment", label: "Pembayaran", question: "Q", recommended: "Tunai", options: ["Tunai","QRIS"], chosen: "Tunai" }],
  assumptions: [], outline: { "prd.overview": "x" } });
assert.equal(getPlan(pid).category, "POS", "roundtrip");
setDecision(pid, "payment", "QRIS");
assert.equal(getPlan(pid).decisions[0].chosen, "QRIS", "decision updated");
assert.equal(getPlan(pid).decisions[0].recommended, "Tunai", "recommended untouched");
assert.equal(getPlan(pid).outline["prd.overview"], "x", "outline untouched");
console.log("db-plan.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/db-plan.test.mjs`
Expected: FAIL — `getPlan is not a function`.

- [ ] **Step 3: Implement in `lib/db.ts`**

Add a projects-column guard next to the users guard:

```ts
{
  const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "plan_json")) db.exec("ALTER TABLE projects ADD COLUMN plan_json TEXT");
}
```

`savePlan` writes `JSON.stringify(plan)`; `getPlan` parses `plan_json` (null when column empty) through `parsePlan` so stored shapes stay normalized; `setDecision` reads the plan, sets `decisions[i].chosen` where `id` matches (validated against `options`), writes back, and bumps `updated_at`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/db-plan.test.mjs`
Expected: `db-plan.test OK`

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts tests/db-plan.test.mjs
git commit -m "feat: persist PRD plan and decisions per project"
```

---

### Task 3: Plan prompt

**Files:**
- Modify: `lib/prompts.ts`
- Test: `tests/prompts.test.mjs`

**Interfaces:**
- Consumes: `APP_PLAYBOOK`, `PRD_SECTIONS`, `Plan` type from `lib/plan.ts`.
- Produces: `buildPlanPrompt(projectTitle: string, description: string): string`.

- [ ] **Step 1: Write the failing test (extend `tests/prompts.test.mjs`)**

```js
const plan = buildPlanPrompt("Warung", "aplikasi kasir untuk warung kopi");
assert.match(plan, /App Playbook/, "plan prompt carries the playbook");
assert.match(plan, /JSON/, "plan prompt demands JSON");
for (const s of PRD_SECTIONS) assert.ok(plan.includes(s.key), `plan prompt lists ${s.key}`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `buildPlanPrompt is not a function`.

- [ ] **Step 3: Implement `buildPlanPrompt` in `lib/prompts.ts`**

Return a system prompt instructing: classify against `APP_PLAYBOOK`; output **only** a JSON object with `category, industry, scale, platform, decisions[], assumptions[], outline{}`; `outline` must contain exactly the 12 `PRD_SECTIONS` keys (list them: `key` — `enTitle`) each with a one-line brief; 3–6 `decisions` each with a recommended option and 2–4 options; 3–6 `assumptions`. Include the description verbatim. No prose outside JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: `prompts.test OK`

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.mjs
git commit -m "feat: plan prompt driven by APP_PLAYBOOK"
```

---

### Task 4: Section-from-plan + refine prompts; retire the write prompt

**Files:**
- Modify: `lib/prompts.ts`
- Modify: `tests/prompts.test.mjs`

**Interfaces:**
- Produces: `buildSectionFromPlanPrompt(section: SectionDef, projectTitle: string, plan: Plan, description: string): string`
- Produces: `buildRefinePrompt(section: SectionDef, projectTitle: string, plan: Plan, currentContent: string, instruction: string): string`
- Removes: `buildWriteSectionPrompt` (superseded).

- [ ] **Step 1: Write the failing test (replace the old write-prompt block in `tests/prompts.test.mjs`)**

```js
const sec = buildSectionFromPlanPrompt(PRD_SECTIONS[0], "Warung", parsePlan(minimalPlanJson), "kasir");
assert.match(sec, /<content>/, "section emits one content block");
assert.match(sec, /ASSUMPTION/, "section fills gaps with labeled assumptions");
assert.match(sec, /ENGLISH/, "section content is English");
assert.match(sec, /### Overview/, "uses the section enTitle");
const ref = buildRefinePrompt(PRD_SECTIONS[0], "Warung", parsePlan(minimalPlanJson), "### Overview\nold", "tambah target user");
assert.match(ref, /<content>/, "refine emits one content block");
assert.match(ref, /tambah target user/, "refine carries the instruction");
```

(`minimalPlanJson` = `"{}"` so `parsePlan` returns the minimal plan.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `buildSectionFromPlanPrompt is not a function`.

- [ ] **Step 3: Implement both builders in `lib/prompts.ts`; delete `buildWriteSectionPrompt`**

`buildSectionFromPlanPrompt`: carry the existing English/`<content>`/`[ASSUMPTION: …]`/no-invented-facts rules, add `planText(plan)` and the raw `description`, and the section's `aiPrompt`. `buildRefinePrompt`: same contract, plus the current content and the instruction ("rewrite this section per the instruction; keep everything already correct"). Remove the old `buildWriteSectionPrompt` and update any imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: `prompts.test OK`

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.mjs
git commit -m "feat: plan-driven section and refine prompts"
```

---

### Task 5: Rework `POST /api/prd` — plan, then bounded-concurrency draft

**Files:**
- Create: `lib/concurrency.ts`
- Create: `tests/concurrency.test.mjs`
- Modify: `app/api/prd/route.ts`

**Interfaces:**
- Produces: `mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>` — preserves order, never exceeds `limit` in flight.
- Consumes: `buildPlanPrompt`, `buildSectionFromPlanPrompt`, `parsePlan`, `savePlan`, `getPlan`, `saveSection`, `extractContent`, `PRD_SECTIONS`.
- Produces SSE events: `plan` (`{ category }`), `section_start`/`section_done`/`error` (each `{ key }`), `done` (`{ written }`). No `chunk` in parallel draft.

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert";
import { mapLimit } from "../lib/concurrency.ts";

let active = 0, peak = 0;
const out = await mapLimit([1,2,3,4,5,6], 2, async (n) => {
  active++; peak = Math.max(peak, active);
  await new Promise((r) => setTimeout(r, 5));
  active--; return n * 2;
});
assert.deepEqual(out, [2,4,6,8,10,12], "order preserved");
assert.ok(peak <= 2, `concurrency capped (peak ${peak})`);
console.log("concurrency.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/concurrency.test.mjs`
Expected: FAIL — cannot find module `../lib/concurrency.ts`.

- [ ] **Step 3: Implement `lib/concurrency.ts`**

`mapLimit`: shared cursor over `items`, `min(limit, items.length)` workers, each pulling the next index and writing to a pre-sized result array; `Promise.all` the workers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/concurrency.test.mjs`
Expected: `concurrency.test OK`

- [ ] **Step 5: Rework `app/api/prd/route.ts`**

Keep auth/config/project/`force` 409 guards and the `ReadableStream` + `send` helper. New body:
1. `description = getMessages(projectId).map(m => m.content).join("\n\n")` (or reuse `conversationText`).
2. Build the plan: `getPlan(projectId)`; if missing, `streamText` with `buildPlanPrompt`, collect text, `parsePlan`, `savePlan`, `send("plan", { category })`. If a plan already exists (re-run), reuse it.
3. `toWrite = sectionsToWrite(getSections(projectId), force)`.
4. `await mapLimit(toWrite, 4, async (section) => { if (request.signal.aborted) return; send("section_start",…); try { collect streamText(buildSectionFromPlanPrompt(...)); const content = extractContent(full); if (content) { saveSection(...); send("section_done",…); written++ } else send("error",…) } catch (e) { send("error", { key, message }) } })`.
5. `send("done", { totalSections: PRD_SECTIONS.length, written })`.

No `chunk` events (concurrent streams would interleave); the client shows per-section status only.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint app/api/prd/route.ts lib/concurrency.ts`
Expected: no output (clean). Then manual: open a fresh project, confirm all 12 sections fill in parallel and a full draft finishes well under the old ~4 min.

- [ ] **Step 7: Commit**

```bash
git add lib/concurrency.ts tests/concurrency.test.mjs app/api/prd/route.ts
git commit -m "feat: plan-then-parallel PRD draft pipeline"
```

---

### Task 6: Refine endpoint

**Files:**
- Create: `app/api/prd/refine/route.ts`
- Modify: `app/projects/[id]/editor.tsx` (call it from the chat box)

**Interfaces:**
- Consumes: `buildRefinePrompt`, `getPlan`, `getSections`, `saveSection`, `extractContent`, `PRD_SECTIONS`.
- Produces: `POST /api/prd/refine` body `{ projectId: number; key: string; instruction: string }`; SSE `chunk`/`section_done`/`error`; 400 on bad input, 404 on wrong owner, 409 if `key` is not a known section.

- [ ] **Step 1: Implement the route**

Mirror `/api/prd` guards. Load `section = PRD_SECTIONS.find(s => s.key === body.key)`; `plan = getPlan(projectId)`; `current = getSections(...).find(...)?.content_md ?? ""`. `streamText(buildRefinePrompt(section, title, plan, current, instruction))`; stream `chunk` (single stream — safe), then `extractContent` → `saveSection` → `section_done`. On failure `error`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx eslint app/api/prd/refine/route.ts`
Expected: clean. Manual: send "tambah target user" for `prd.overview`; only that section changes.

- [ ] **Step 3: Commit**

```bash
git add app/api/prd/refine/route.ts
git commit -m "feat: per-section refine endpoint"
```

---

### Task 7: Description-first project creation + decision action

**Files:**
- Modify: `app/actions.ts`
- Modify: `components/project-list.tsx`
- Test: `tests/prd.test.mjs` (helper only)

**Interfaces:**
- Produces: `createProjectAction(title: string, description?: string): Promise<Project>` — persists the description as the first `messages` row (`role: "user"`) via `addMessage`.
- Produces: `setDecisionAction(projectId: number, id: string, chosen: string): Promise<void>` — ownership-checked; calls `setDecision`.
- Produces (pure): `deriveTitle(description: string): string` in `lib/prd.ts` — first non-empty line, trimmed, capped at 60 chars.

- [ ] **Step 1: Write the failing test (extend `tests/prd.test.mjs`)**

```js
import { deriveTitle } from "../lib/prd.ts";
assert.equal(deriveTitle("Aplikasi kasir\nuntuk warung"), "Aplikasi kasir");
assert.equal(deriveTitle("\n\n  Kasir  \n"), "Kasir");
assert.equal(deriveTitle("x".repeat(80)).length, 60, "capped");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: FAIL — `deriveTitle is not a function`.

- [ ] **Step 3: Implement `deriveTitle` in `lib/prd.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: `prd.test OK`

- [ ] **Step 5: Update `app/actions.ts` and `components/project-list.tsx`**

`createProjectAction`: when `description?.trim()` is non-empty, `addMessage(id, "user", description.trim())` after the insert (title falls back to `deriveTitle(description)` when the title is empty). Add `setDecisionAction` with the same ownership pattern as `saveSectionAction`. In `project-list.tsx`, the dialog gets a title `Input` plus a `Textarea` "Ceritakan aplikasimu sebanyak yang kamu mau"; submit calls `createProjectAction(title, description)` and navigates to the project.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint app/actions.ts components/project-list.tsx lib/prd.ts`
Expected: clean. Manual: create a project with only a description → it lands on the project page with the description as the first message.

- [ ] **Step 7: Commit**

```bash
git add app/actions.ts components/project-list.tsx lib/prd.ts tests/prd.test.mjs
git commit -m "feat: description-first project creation"
```

---

### Task 8: Document-first project page, auto-run, and decisions panel

**Files:**
- Create: `components/decision-panel.tsx`
- Modify: `lib/prd.ts` (add `shouldAutoRun`)
- Modify: `app/projects/[id]/page.tsx`
- Modify: `app/projects/[id]/editor.tsx`
- Test: `tests/prd.test.mjs`

**Interfaces:**
- Produces (pure): `shouldAutoRun(hasContent: boolean, aiReady: boolean, alreadyStarted: boolean): boolean` — `aiReady && !hasContent && !alreadyStarted`.
- Consumes: `getPlan`, `getMessages`, `getSections`; `setDecisionAction`; `/api/prd`; `/api/prd/refine`.
- `decision-panel.tsx` props: `{ projectId: number; plan: Plan | null }` — renders each decision as a chip with its options (recommended preselected); changing one calls `setDecisionAction` then the refine endpoint for the affected section(s), then `router.refresh()`.

- [ ] **Step 1: Write the failing test (extend `tests/prd.test.mjs`)**

```js
import { shouldAutoRun } from "../lib/prd.ts";
assert.equal(shouldAutoRun(false, true, false), true, "empty + ready + not started");
assert.equal(shouldAutoRun(true, true, false), false, "has content");
assert.equal(shouldAutoRun(false, false, false), false, "no ai");
assert.equal(shouldAutoRun(false, true, true), false, "already started");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: FAIL — `shouldAutoRun is not a function`.

- [ ] **Step 3: Implement `shouldAutoRun` in `lib/prd.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: `prd.test OK`

- [ ] **Step 5: Wire the page + editor**

`page.tsx`: pass `plan={getPlan(project.id)}` and `initialMessages` (already passed). `editor.tsx`: accept `plan`; on mount, `if (shouldAutoRun(hasContent, aiReady, startedRef.current)) { startedRef.current = true; void runPrd(false) }`; render `<DecisionPanel projectId={project.id} plan={plan} />` near the PRD section; keep the existing collapsed cards + progress UI (parallel mode shows status badges, no live preview). The "Buat PRD" button becomes "Buat ulang" after the first draft.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint app/projects/[id]/editor.tsx components/decision-panel.tsx app/projects/[id]/page.tsx`
Expected: clean. Manual: fresh project auto-drafts; reopen does not re-draft; a decision chip updates its section.

- [ ] **Step 7: Commit**

```bash
git add components/decision-panel.tsx lib/prd.ts app/projects/[id]/page.tsx app/projects/[id]/editor.tsx tests/prd.test.mjs
git commit -m "feat: document-first project page with auto-run and decisions"
```

---

### Task 9: Copy alignment

**Files:**
- Modify: `app/page.tsx` (hero + feature copy)
- Modify: `lib/render.ts` (`CARA_PAKAI_MD`)
- Modify: `AGENTS.md` (flow description)
- Test: `tests/render.test.mjs`

**Interfaces:** none new.

- [ ] **Step 1: Update copy**

Home hero: lead with "ceritakan sekali → PRD lengkap → cek beberapa keputusan". `CARA_PAKAI_MD`: note the PRD may contain `[ASSUMPTION: …]` lines the owner should review. `AGENTS.md`: replace the "two phases" description with the plan → parallel-draft → decisions flow.

- [ ] **Step 2: Verify**

Run: `node --experimental-strip-types tests/render.test.mjs && npx tsc --noEmit && npx eslint app/page.tsx lib/render.ts`
Expected: `render.test OK` and clean.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx lib/render.ts AGENTS.md
git commit -m "docs: align copy with one-shot flow"
```

---

## Final Verification

- `npx tsc --noEmit` — clean.
- `npx eslint <changed files>` — clean.
- All tests: `auth db-messages prd prompts render sse plan db-plan concurrency`.
- Manual end-to-end against a real OpenAI-compatible endpoint: create from a one-line idea → full PRD auto-drafts in parallel → accept/change a decision → refine one section → export ZIP.
