# Discovery Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short, guided discovery gate before the PRD: the AI asks a few recommendation-backed questions (max 8, AI-decided length), then the existing plan → parallel-draft pipeline runs.

**Architecture:** Discovery is a chat whose assistant turns are one tolerant-parsed JSON object (question + 2–4 options + `done`). Answers persist in the existing `messages` table; a `projects.discovery_done` flag gates the draft pipeline, which is otherwise unchanged and reads the discovery transcript through a prose renderer.

**Tech Stack:** Next.js 16 (App Router), SQLite via better-sqlite3, `@ai-sdk/openai` `provider.chat`, React client components, Tailwind 4 + Base UI primitives.

**Spec:** `docs/superpowers/specs/2026-11-05-specly-discovery-gate-design.md`

## Global Constraints

- Next.js 16 App Router; `output: "standalone"`; SQLite (better-sqlite3).
- LLM calls use `createOpenAI({ baseURL, apiKey }).chat(model)` only.
- No new runtime dependency.
- `lib/prompts.ts` stays the single source of truth for prompts.
- UI/chat copy **Indonesian**; document content **English** inside one `<content>` block.
- Question cap is **8**; the first option in a question is the **recommendation**.
- Design tokens: primary `#D946EF`, CTA `#EA580C`, headings Rubik / body Nunito Sans, transitions 150–300ms, `cursor-pointer`, visible focus, `prefers-reduced-motion` respected.
- `/api/prd` 409 body carries `reason`: `"discovery"` (discussion unfinished) or `"content"` (content exists).
- Pure helpers get a test run with `node --experimental-strip-types tests/<name>.test.mjs`; API routes and client components have no unit harness — verified with `npx tsc --noEmit` + `npx eslint`.

## Review Focus

Spec-implied inputs/conditions no task's tests fully exercise; each line names the behavior a reasonable person expects, and the task that owns its test/check.

1. **Malformed or prose discovery reply** (model ignores the JSON contract) — must never dead-end; the parser degrades to a plain turn and the user can still answer or press "Cukup, lanjut". → test in Task 1.
2. **Free-text answer not among the options** — must survive into the decision's `chosen`, not be silently replaced by the recommendation. → test in Task 2.
3. **`done: true` on the very first turn** (idea already crisp) — discovery ends immediately and the draft runs; no question render. → check in Task 7.
4. **"Cukup, lanjut" before any answer**, or before question 1 resolves — clean hand-off to the draft, no crash. → check in Task 7.
5. **Estimate with zero sections done yet** — shows "memperkirakan…", never `NaN`/`∞`/negative. → test in Task 8.
6. **Pre-existing project** (migrated, `discovery_done` backfilled 1) — never shows the discovery card. → manual end-to-end step in Task 9.

---

### Task 1: `lib/discovery.ts` — turn parser + cap

**Files:**
- Create: `lib/discovery.ts`
- Test: `tests/discovery.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type DiscoveryTurn = { say: string; question: { text: string; options: string[] } | null; done: boolean }`
  - `const DISCOVERY_MAX = 8`
  - `parseDiscoveryTurn(raw: string): DiscoveryTurn` — never throws.
  - `canAskMore(askedCount: number, max?: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/discovery.test.mjs`:

```js
import assert from "node:assert/strict";
import { parseDiscoveryTurn, canAskMore, DISCOVERY_MAX } from "../lib/discovery.ts";

const t = parseDiscoveryTurn(
  '{"say":"Oke","question":{"text":"Pembayaran?","options":["Transfer","QRIS"]},"done":false}',
);
assert.equal(t.say, "Oke");
assert.equal(t.question.text, "Pembayaran?");
assert.deepEqual(t.question.options, ["Transfer", "QRIS"]);
assert.equal(t.done, false);

const fenced = parseDiscoveryTurn('```json\n{"say":"","question":null,"done":true}\n```');
assert.equal(fenced.done, true);
assert.equal(fenced.question, null);

// prose reply never throws; degrades to a plain turn
const prose = parseDiscoveryTurn("Apa nama aplikasimu?");
assert.equal(prose.question, null);
assert.equal(prose.done, false);
assert.match(prose.say, /nama aplikasi/);

// question with no valid string options is dropped
const bad = parseDiscoveryTurn('{"question":{"text":"x","options":[1,null]},"done":false}');
assert.equal(bad.question, null);

assert.equal(canAskMore(0), true);
assert.equal(canAskMore(DISCOVERY_MAX - 1), true);
assert.equal(canAskMore(DISCOVERY_MAX), false);
assert.equal(DISCOVERY_MAX, 8);

console.log("discovery.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/discovery.test.mjs`
Expected: FAIL — "Cannot find module '../lib/discovery.ts'".

- [ ] **Step 3: Implement `lib/discovery.ts`**

Pure module; no imports. Model `parseDiscoveryTurn` on the tolerant ladder used by `lib/plan.ts` (`parsePlan`): strip a fenced block, `JSON.parse` inside `try`, then a balanced-brace scan, then the prose fallback. Validate: `say` is a string (default `""`); `question` is kept only when it has a string `text` and, after filtering, at least one string in `options`; `done` is `raw.done === true`. `canAskMore(asked, max = DISCOVERY_MAX)` returns `asked < max`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/discovery.test.mjs`
Expected: `discovery.test OK`

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint lib/discovery.ts tests/discovery.test.mjs`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/discovery.ts tests/discovery.test.mjs
git commit -m "feat: tolerant discovery-turn parser"
```

---

### Task 2: Relax `normalizeDecision` so a free-text choice survives

**Files:**
- Modify: `lib/plan.ts` (the `normalizeDecision` helper and the comment above it)
- Test: `tests/plan.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `parsePlan` keeps a decision's `chosen` verbatim whenever it is a non-empty string (defaulting to `recommended` only when `chosen` is missing/empty). `Decision`, `Plan`, `parsePlan`, `minimalPlan`, `planText` signatures unchanged.

- [ ] **Step 1: Write the failing test**

Append to `tests/plan.test.mjs` (import `parsePlan` is already there):

```js
const custom = parsePlan(
  JSON.stringify({
    decisions: [
      {
        id: "pay",
        label: "Pembayaran",
        question: "Bagaimana pembayaran?",
        recommended: "Transfer",
        options: ["Transfer", "QRIS"],
        chosen: "Transfer + e-wallet",
      },
    ],
  }),
);
assert.equal(custom.decisions[0].chosen, "Transfer + e-wallet");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/plan.test.mjs`
Expected: FAIL — `chosen` is coerced back to `"Transfer"`.

- [ ] **Step 3: Change `normalizeDecision` in `lib/plan.ts`**

Replace the "force chosen into options; fall back to recommended" logic with: keep `chosen` when it is a non-empty trimmed string as-is; otherwise use `recommended`. Normalize `options` as before. Update the comment above the helper to state exactly this.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/plan.test.mjs`
Expected: `plan.test OK` (existing assertions still pass).

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint lib/plan.ts tests/plan.test.mjs`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/plan.ts tests/plan.test.mjs
git commit -m "feat(plan): keep a free-text chosen decision"
```

---

### Task 3: Transcript renderer + `shouldAutoRun` gains `discoveryDone`

**Files:**
- Modify: `lib/prd.ts`
- Test: `tests/prd.test.mjs`

**Interfaces:**
- Consumes from Task 1: `parseDiscoveryTurn`, `DiscoveryTurn`.
- Produces:
  - `shouldAutoRun(hasContent: boolean, aiReady: boolean, alreadyStarted: boolean, discoveryDone = false): boolean` → `aiReady && !hasContent && !alreadyStarted && discoveryDone`. The 4th parameter defaults to `false` so the tree compiles before Task 7 passes the real value; Task 7 supplies it.
  - `conversationText(messages: { role: string; content: string }[]): string` — assistant messages that parse as a discovery turn render as readable prose (`say` + question text + options joined), everything else renders verbatim. Used by `POST /api/prd` (Task 6).

- [ ] **Step 1: Write the failing test**

Append to `tests/prd.test.mjs`:

```js
const txt = conversationText([
  { role: "user", content: "Aplikasi kasir untuk warung" },
  {
    role: "assistant",
    content: '{"say":"Oke","question":{"text":"Pembayaran?","options":["Transfer","QRIS"]},"done":false}',
  },
]);
assert.match(txt, /kasir untuk warung/);
assert.match(txt, /Pembayaran\?/);
assert.match(txt, /Transfer/);
assert.doesNotMatch(txt, /\{"say"/);

assert.equal(shouldAutoRun(false, true, false, false), false);
assert.equal(shouldAutoRun(false, true, false, true), true);
assert.equal(shouldAutoRun(false, false, false, true), false);
assert.equal(shouldAutoRun(true, true, false, true), false);
assert.equal(shouldAutoRun(false, true, true, true), false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: FAIL — `shouldAutoRun` takes 3 args; `conversationText` emits raw JSON.

- [ ] **Step 3: Implement in `lib/prd.ts`**

Import `parseDiscoveryTurn` from `./discovery.ts`. Update `conversationText` to map assistant turns through `parseDiscoveryTurn`: when it yields a `say` or a `question`, emit `assistant: <say>` plus, if present, a line `Pertanyaan: <text>` and `Opsi: <options.join(" | ")>`; otherwise emit `assistant: <content>` verbatim. Add the `discoveryDone` parameter to `shouldAutoRun` and `&& discoveryDone` to the expression.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prd.test.mjs`
Expected: `prd.test OK`

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint lib/prd.ts tests/prd.test.mjs`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/prd.ts tests/prd.test.mjs
git commit -m "feat(prd): render discovery transcript, gate auto-run on discovery"
```

---

### Task 4: `buildDiscoveryPrompt`

**Files:**
- Modify: `lib/prompts.ts` (rename `buildExplorePrompt` → `buildDiscoveryPrompt`, change its body)
- Modify: `app/api/chat/route.ts` (import + call site, minimal, so the tree compiles; the route is reworked in Task 6)
- Test: `tests/prompts.test.mjs`

**Interfaces:**
- Consumes: `APP_PLAYBOOK`, `PRD_SECTIONS`.
- Produces: `buildDiscoveryPrompt(projectTitle: string, prdContextMd: string, askedCount: number, max: number): string`.

- [ ] **Step 1: Write the failing test**

Append to `tests/prompts.test.mjs`:

```js
const dp = buildDiscoveryPrompt("Kasir", "", 0, 8);
assert.match(dp, /JSON/);
assert.match(dp, /"options"/);
assert.match(dp, /"done"/);
assert.match(dp, /rekomendasi/i);
assert.match(dp, /8/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `buildDiscoveryPrompt` is not exported.

- [ ] **Step 3: Implement in `lib/prompts.ts`**

Rename `buildExplorePrompt` to `buildDiscoveryPrompt`, add `askedCount` and `max` parameters, and change the instruction body so the reply is **only** one JSON object:
`{ "say": string, "question": { "text": string, "options": string[] } | null, "done": boolean }`
— keep the existing recommendation-first rules (classify against `APP_PLAYBOOK`, state assumptions, ask only what cannot be defaulted, Indonesian, never write document content), add: the **first option is the recommendation**; give the options 2–4 entries; set `done: true` as soon as you understand the idea (no `question` then); you have asked `askedCount` of `max` questions, and at `max` you must return `done: true`. Keep the `prdContextMd` grounding block.

- [ ] **Step 4: Update the caller in `app/api/chat/route.ts`**

Change the import and the call to `buildDiscoveryPrompt(project.title, prdContext, 0, DISCOVERY_MAX)` (import `DISCOVERY_MAX` from `@/lib/discovery`). The count is computed properly in Task 6.

- [ ] **Step 5: Run test + verify**

Run: `node --experimental-strip-types tests/prompts.test.mjs && npx tsc --noEmit && npx eslint lib/prompts.ts app/api/chat/route.ts tests/prompts.test.mjs`
Expected: `prompts.test OK`, clean.

- [ ] **Step 6: Commit**

```bash
git add lib/prompts.ts app/api/chat/route.ts tests/prompts.test.mjs
git commit -m "feat: discovery prompt with structured JSON turn"
```

---

### Task 5: `projects.discovery_done` column + accessors

**Files:**
- Modify: `lib/db.ts`
- Test: `tests/db-discovery.test.mjs`

**Interfaces:**
- Produces: `isDiscoveryDone(projectId: number): boolean`, `markDiscoveryDone(projectId: number): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/db-discovery.test.mjs` following the temp-DB pattern in `tests/db-plan.test.mjs` (set `process.env.PRD_DB_PATH` to a temp file before importing `../lib/db.ts`): create a user + project, then:

```js
assert.equal(isDiscoveryDone(projectId), false);
markDiscoveryDone(projectId);
assert.equal(isDiscoveryDone(projectId), true);
markDiscoveryDone(projectId); // idempotent
assert.equal(isDiscoveryDone(projectId), true);
console.log("db-discovery.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/db-discovery.test.mjs`
Expected: FAIL — `isDiscoveryDone` is not exported.

- [ ] **Step 3: Implement in `lib/db.ts`**

Add `discovery_done INTEGER NOT NULL DEFAULT 0` to the `projects` table definition. In the existing migration guard (the `PRAGMA table_info` check), when the column is **absent**: `ALTER TABLE projects ADD COLUMN discovery_done INTEGER NOT NULL DEFAULT 0`, then a one-time `UPDATE projects SET discovery_done = 1` (backfill: every pre-existing project skips the gate). Add the two accessors, following the ownership-free shape of `getPlan`/`savePlan`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/db-discovery.test.mjs`
Expected: `db-discovery.test OK`

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint lib/db.ts tests/db-discovery.test.mjs`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/db.ts tests/db-discovery.test.mjs
git commit -m "feat(db): persist discovery_done per project"
```

---

### Task 6: Server wiring — discovery endpoint, finish action, `/api/prd` guard + renderer

**Files:**
- Create: `app/api/discovery/route.ts` (from `app/api/chat/route.ts`)
- Delete: `app/api/chat/route.ts`
- Modify: `app/actions.ts` (`finishDiscoveryAction`)
- Modify: `app/api/prd/route.ts` (transcript renderer + discovery 409)
- Modify: `app/projects/[id]/editor.tsx` (one line: the fetch URL `/api/chat` → `/api/discovery`)

**Interfaces:**
- Consumes: `buildDiscoveryPrompt` (T4), `conversationText` (T3), `isDiscoveryDone`/`markDiscoveryDone` (T5), `DISCOVERY_MAX` (T1).
- Produces:
  - `POST /api/discovery`, body `{ projectId: number; message?: string }`.
  - `finishDiscoveryAction(projectId: number): Promise<void>`.

- [ ] **Step 1: Create `app/api/discovery/route.ts`**

Move the current chat route and change: body type `{ projectId: number; message?: string }`; validate `projectId` as before; if `message` is present it must be a non-empty string (else 400) and is persisted first with `addMessage(projectId, "user", message)`; if absent, require at least one existing message (else 400) and persist nothing. Compute `askedCount` as the number of `assistant` messages already stored; build the system prompt with `buildDiscoveryPrompt(project.title, buildPrdContext(getSections(projectId)), askedCount, DISCOVERY_MAX)`. Keep the guards, the `provider.chat` call, `onEnd` persistence, and the drain-on-end behavior.

- [ ] **Step 2: Delete `app/api/chat/route.ts`; point the editor's fetch at `/api/discovery`**

- [ ] **Step 3: Add `finishDiscoveryAction` to `app/actions.ts`**

`"use server"`; `requireUser()`; verify ownership with the same `SELECT user_id ... WHERE id = :id` pattern used by `saveSectionAction`; then `markDiscoveryDone(projectId)`. Signature `finishDiscoveryAction(projectId: number): Promise<void>`.

- [ ] **Step 4: Update `app/api/prd/route.ts`**

Replace the inline `getMessages(...).map((m) => m.content).join("\n\n")` with `conversationText(getMessages(...))`. Add, next to the existing content-409 guard, an earlier guard: `if (!isDiscoveryDone(projectId) && !force) return Response.json({ error: "Selesaikan diskusi dulu", reason: "discovery" }, { status: 409 })`. Add `reason: "content"` to the existing content-exists 409 body.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint "app/api/discovery/route.ts" "app/api/prd/route.ts" app/actions.ts "app/projects/[id]/editor.tsx"`
Expected: clean. (Routes have no unit harness; this static check is the evidence.)

- [ ] **Step 6: Commit**

```bash
git add "app/api/discovery/route.ts" app/api/prd/route.ts app/actions.ts "app/projects/[id]/editor.tsx"
git rm app/api/chat/route.ts
git commit -m "feat: discovery endpoint, finish action, PRD discovery guard"
```

---

### Task 7: Post-discovery UI — discovery card, hand-off, read-only panel

**Files:**
- Modify: `app/projects/[id]/editor.tsx`
- Modify: `app/projects/[id]/page.tsx` (pass `discoveryDone`)
- Modify: `components/decision-panel.tsx` (read-only summary + "Buat ulang")
- Modify: `components/project-list.tsx` (description required)

**Interfaces:**
- Consumes: `parseDiscoveryTurn`, `DISCOVERY_MAX` (T1), `shouldAutoRun` 4-arg (T3), `finishDiscoveryAction` (T6), `isDiscoveryDone` (T5), `/api/discovery` (T6).

- [ ] **Step 1: Thread `discoveryDone`**

`app/projects/[id]/page.tsx`: pass `discoveryDone={isDiscoveryDone(project.id)}` to `<Editor>`. `Editor` accepts `discoveryDone: boolean`. Update the `shouldAutoRun(hasContent, aiReady, startedRef.current, discoveryDone)` call.

- [ ] **Step 2: Discovery card in `editor.tsx`**

While `!hasContent && !discoveryDone`: render a discovery card instead of the chat card. It reads the last persisted/streamed assistant turn via `parseDiscoveryTurn`, and shows: any `say`, the `question.text`, one button per option (the first labelled "Rekomendasi"), a free-text box, a progress line `Pertanyaan {askedCount + 1} · maks {DISCOVERY_MAX}`, a send button, and **Cukup, lanjut**. On mount, if there is no assistant turn yet and `aiReady`, POST `/api/discovery` with `{ projectId }` (no message) to fetch question 1. Sending an answer POSTs `{ projectId, message }` and appends the assistant turn. When the parsed turn has `done: true`, or the cap is reached, or the user presses **Cukup, lanjut**, call `finishDiscoveryAction(project.id)` then `void runPrd(false)`.

- [ ] **Step 3: After discovery — recap + PRD button**

When `discoveryDone || hasContent`, render the existing sections + progress UI and the PRD button (`Buat PRD` / `Buat ulang`) without the discovery card. If `!aiReady`, show the existing guidance and no discovery start.

- [ ] **Step 4: Branch the two 409 reasons in `runPrd`**

Currently any 409 opens the "Timpa PRD?" dialog. Read the response body: `reason === "discovery"` → toast "Selesaikan diskusi dulu"; `reason === "content"` → open the confirm dialog (current behavior).

- [ ] **Step 5: `components/decision-panel.tsx` read-only**

Props stay `{ projectId: number; plan: Plan | null }`. Render the plan's decisions as a read-only summary (label + `chosen`, with `recommended` and `options` shown as context). Remove the option buttons and the `setDecisionAction` call; keep a **Buat ulang** affordance (a button that triggers the existing `runPrd(true)` path passed in as a prop, or a documented note if the button stays in the editor). Render nothing when `plan` is null or has no decisions.

- [ ] **Step 6: `components/project-list.tsx` requires a description**

Disable submit and show a hint when the description is empty (title may be empty). Keep the existing `deriveTitle` fallback.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx eslint "app/projects/[id]/editor.tsx" "app/projects/[id]/page.tsx" components/decision-panel.tsx components/project-list.tsx`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add "app/projects/[id]/editor.tsx" "app/projects/[id]/page.tsx" components/decision-panel.tsx components/project-list.tsx
git commit -m "feat(ui): guided discovery card and read-only decisions"
```

---

### Task 8: Loading feedback with estimates + UI polish

**Files:**
- Create: `lib/estimate.ts`
- Test: `tests/estimate.test.mjs`
- Modify: `app/projects/[id]/editor.tsx` (progress + skeletons + typing indicator + "Sunting" → "Review")

**Interfaces:**
- Produces: `estimateRemainingMs(done: number, total: number, elapsedMs: number): number | null` — `null` when `done <= 0`, else `Math.round((elapsedMs / done) * (total - done))`.

- [ ] **Step 1: Write the failing test**

Create `tests/estimate.test.mjs`:

```js
import assert from "node:assert/strict";
import { estimateRemainingMs } from "../lib/estimate.ts";

assert.equal(estimateRemainingMs(0, 12, 5000), null);
assert.equal(estimateRemainingMs(3, 12, 3000), 9000);
assert.equal(estimateRemainingMs(12, 12, 9000), 0);
console.log("estimate.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/estimate.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/estimate.ts`** as specified above.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/estimate.test.mjs`
Expected: `estimate.test OK`

- [ ] **Step 5: Wire it into `editor.tsx`**

Track the draft start time; compute `estimateRemainingMs(doneCount, PRD_SECTIONS.length, Date.now() - start)`. Show, next to `N/12 bagian`, `perkiraan ~Xs tersisa` when non-null and `memperkirakan…` when `null`. Replace the plain progress with the `Progress` component animating to `doneCount/total`, and render a shimmering skeleton for each section still `pending`/`generating`. During discovery, show the existing `AiTyping` indicator while the next question is streamed. All motion honours `prefers-reduced-motion`.

- [ ] **Step 6: Rename the toggle**

`editor.tsx:642` `{open ? "Tutup" : "Sunting"}` → `{open ? "Tutup" : "Review"}`, and reword the hint at `editor.tsx:614` so it reads naturally with "Review".

- [ ] **Step 7: Verify**

Run: `node --experimental-strip-types tests/estimate.test.mjs && npx tsc --noEmit && npx eslint lib/estimate.ts tests/estimate.test.mjs "app/projects/[id]/editor.tsx"`
Expected: `estimate.test OK`, clean.

- [ ] **Step 8: Commit**

```bash
git add lib/estimate.ts tests/estimate.test.mjs "app/projects/[id]/editor.tsx"
git commit -m "feat(ui): draft estimate, skeleton loading, rename to Review"
```

---

### Task 9: Copy alignment + full verification

**Files:**
- Modify: `app/page.tsx` (hero + feature copy)
- Modify: `lib/render.ts` (`CARA_PAKAI_MD`)
- Modify: `AGENTS.md` (flow description)
- Test: `tests/render.test.mjs` (only if a `CARA_PAKAI_MD` assertion must change)

**Interfaces:** none new.

- [ ] **Step 1: Update copy**

Home hero: lead with "ceritakan idemu → beberapa pertanyaan singkat → PRD lengkap". `CARA_PAKAI_MD`: add the discovery step and keep the note that the PRD may contain `[ASSUMPTION: …]` lines to review. `AGENTS.md`: replace the "one-shot auto-draft on first open" description with the discovery-gate → plan → parallel-draft → decisions-summary → refine flow, and update the endpoints/verify sections (`/api/discovery`, `lib/discovery.ts`, `lib/estimate.ts`, new tests).

- [ ] **Step 2: Verify**

Run: `node --experimental-strip-types tests/render.test.mjs && npx tsc --noEmit && npx eslint app/page.tsx lib/render.ts`
Expected: `render.test OK`, clean.

- [ ] **Step 3: Run every suite**

Run each with `node --experimental-strip-types tests/<name>.test.mjs`:
`auth db-messages prd prompts render sse plan db-plan concurrency discovery db-discovery estimate`
Expected: all OK.

- [ ] **Step 4: Manual end-to-end (Review Focus lines 3–4, 6)**

Against a real OpenAI-compatible endpoint: create a project from a one-line idea → discovery asks question 1 with recommendation options → answer with a chip, answer one with free text, and once press **Cukup, lanjut** → PRD drafts (estimate shown) → the decision summary reflects the free-text answer → press **Buat ulang** → refine one section → export ZIP. Also open a pre-existing (migrated) project and confirm it does not show the discovery card.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx lib/render.ts AGENTS.md tests/render.test.mjs
git commit -m "docs: align copy with the discovery flow"
```

---

## Self-Review

- **Spec coverage:** intent/goals (T1–T8), gate + hand-off (T6–T7), JSON turn contract (T1, T4), AI-decided cap 8 (T1, T4, T7), "Cukup, lanjut" (T7), decision summary read-only + Buat ulang (T7), plan mirrors `chosen` (T2, T6 renderer), backfill legacy (T5), 409 `reason` (T6), UI/UX + loading estimates (T8), copy + "Sunting"→"Review" (T8, T9), quality bars (Global Constraints + task verification steps). No spec requirement without a task.
- **Type consistency:** `parseDiscoveryTurn`/`DiscoveryTurn`/`DISCOVERY_MAX`/`canAskMore` (T1) are used verbatim in T3, T4, T6, T7. `conversationText` (T3) is consumed in T6. `discoveryDone` (T5) threads page → editor in T7. `estimateRemainingMs` (T8) is used in T8 only. `finishDiscoveryAction` (T6) is called in T7.
- **Placeholders:** none; every step names a file, a signature, or a test with its assertions.
- **Review Focus:** each of the six lines names the task that owns its test/check (T1, T2, T7, T7, T8, T9).
