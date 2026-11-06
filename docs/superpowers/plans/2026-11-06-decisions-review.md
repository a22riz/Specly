# Decisions Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user review the plan's decisions at a high level inside the "Keputusan yang dipakai" panel — change each decision (option or free text), ask the AI to rewrite them — and re-draft from the result.

**Architecture:** The decisions live in `projects.plan_json` (`Plan.decisions`). The panel becomes editable client-side; a server action persists manual edits via `savePlan`, and a new route rewrites decisions through one `provider.chat` call. "Buat ulang" re-drafts from the updated plan. No new storage, no new dependency.

**Tech Stack:** Next.js 16 (App Router), `@ai-sdk/openai` `provider.chat`, React client components, Tailwind 4 + Base UI primitives.

**Spec:** `docs/superpowers/specs/2026-11-06-decisions-review-design.md`

## Global Constraints

- Next.js 16 App Router; `output: "standalone"`.
- No new runtime dependency. LLM calls use `createOpenAI({ baseURL, apiKey }).chat(model)` only.
- `lib/prompts.ts` stays the single source of truth for prompts.
- Decisions are stored in `projects.plan_json` — reuse `getPlan` / `savePlan`. **No new DB column or accessor.**
- Every route and server action checks `project.user_id === user.id` before reading or writing (mirror `saveSectionAction` / `/api/prd/refine`).
- A free-text `chosen` outside `options` must survive every path (`normalizeDecision` keeps it; never coerce it to an option).
- UI copy **Indonesian**; document content **English**.
- UI follows the live `app/globals.css` theme via semantic classes (not the drifted `MASTER.md`); transitions 150–300ms, `cursor-pointer`, visible focus, `prefers-reduced-motion` respected.
- Pure helpers are verified with `node --experimental-strip-types tests/<name>.test.mjs`; routes and client components have no unit harness — verified with `npx tsc --noEmit` + `npx eslint`.

## Review Focus

Inputs/conditions the spec implies but no task's tests fully exercise; each line names the behavior a reasonable person expects, and the task that owns its test/check.

1. **Free-text decision value outside the options** — must survive Save and reload as `chosen` (not snapped to the recommendation). → check in Task 3.
2. **AI rewrite drops or omits a decision** — the stored decision must not vanish; updates apply by `id`, nothing is removed. → test in Task 2.
3. **AI rewrite returns empty/unparseable output, or the call fails** — the stored plan stays untouched and the panel shows an error, no data loss. → check in Task 2/3.
4. **Unsaved edits, then "Buat ulang"** — the edits must not be silently dropped; "Buat ulang" is disabled while dirty. → check in Task 3.
5. **AI not configured (no key/model)** — the rewrite returns a clear error and edits are still saveable. → check in Task 2.

---

### Task 1: `buildDecisionsRefinePrompt`

**Files:**
- Modify: `lib/prompts.ts`
- Test: `tests/prompts.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `buildDecisionsRefinePrompt(planText: string, instruction: string): string`.

- [ ] **Step 1: Write the failing test**

Append to `tests/prompts.test.mjs` (import `buildDecisionsRefinePrompt` alongside the other builders):

```js
const dr = buildDecisionsRefinePrompt(
  "Decisions:\n- Pembayaran — chosen: Transfer (recommended: Transfer; options: Transfer, QRIS)",
  "jadikan QRIS",
);
assert.match(dr, /decisions/);
assert.match(dr, /jadikan QRIS/);
assert.match(dr, /"id"/);
assert.match(dr, /Pembayaran/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `buildDecisionsRefinePrompt` is not exported.

- [ ] **Step 3: Implement `buildDecisionsRefinePrompt` in `lib/prompts.ts`**

An English system prompt (matching the style of `buildRefinePrompt`) that: embeds `planText` and the user `instruction`; instructs the model to rewrite **only** the `decisions`, keeping each decision's `id` stable (never add or remove decisions, never rename `id`); keeps the first option as the recommendation; keeps any decision the instruction does not affect unchanged; and returns **only** one JSON object `{ "decisions": [ { "id", "label", "question", "recommended", "options", "chosen" } ] }` with no prose or fences.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: `prompts.test OK`

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint lib/prompts.ts tests/prompts.test.mjs`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.mjs
git commit -m "feat(prompts): decisions-rewrite prompt"
```

---

### Task 2: `mergeDecisions` + `saveDecisionsAction` + `POST /api/prd/decisions`

**Files:**
- Modify: `lib/plan.ts` (`mergeDecisions`)
- Test: `tests/plan.test.mjs`
- Modify: `app/actions.ts` (`saveDecisionsAction`)
- Create: `app/api/prd/decisions/route.ts`

**Interfaces:**
- Consumes from Task 1: `buildDecisionsRefinePrompt(planText, instruction)`.
- Produces:
  - `mergeDecisions(plan: Plan, next: Decision[]): Plan` — keep the stored decision order; for each stored decision, replace it with the `next` entry of the same `id` when present, otherwise keep the stored one; append any `next` entries whose `id` is new. Never removes a stored decision.
  - `saveDecisionsAction(projectId: number, decisions: Decision[]): Promise<void>`.
  - `POST /api/prd/decisions`, body `{ projectId: number; instruction: string }` → `200 { decisions: Decision[] }` (with the saved plan), or a JSON error.

- [ ] **Step 1: Write the failing test**

Append to `tests/plan.test.mjs` (import `mergeDecisions` alongside `parsePlan`):

```js
const base = parsePlan(
  JSON.stringify({
    decisions: [
      { id: "D1", label: "A", recommended: "x", options: ["x", "y"], chosen: "x" },
      { id: "D2", label: "B", recommended: "p", options: ["p", "q"], chosen: "p" },
    ],
  }),
);
const merged = mergeDecisions(base, [
  { id: "D1", label: "A", question: "", recommended: "x", options: ["x", "y"], chosen: "QRIS" },
]);
assert.equal(merged.decisions.length, 2);
assert.equal(merged.decisions.find((d) => d.id === "D1").chosen, "QRIS");
assert.equal(merged.decisions.find((d) => d.id === "D2").chosen, "p");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/plan.test.mjs`
Expected: FAIL — `mergeDecisions` is not exported.

- [ ] **Step 3: Implement `mergeDecisions` in `lib/plan.ts`**

Map over `plan.decisions`, substituting the matching `next` entry by `id`; then append `next` entries whose `id` is not already present. Return `{ ...plan, decisions }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/plan.test.mjs`
Expected: `plan.test OK`

- [ ] **Step 5: Add `saveDecisionsAction` to `app/actions.ts`**

`"use server"`; `getSessionUser()` → throw `"Silakan masuk dulu"` if absent; ownership check via `SELECT user_id FROM projects WHERE id = ?` exactly like `saveSectionAction`; then `savePlan(projectId, { ...(getPlan(projectId) ?? minimalPlan()), decisions })`. Import `savePlan`, `getPlan`, `minimalPlan`, and the `Decision` type as needed.

- [ ] **Step 6: Create `app/api/prd/decisions/route.ts`**

Mirror `/api/prd/refine`'s preamble: `getSessionUser` (401), parse body (`{ projectId, instruction }`, both required → 400), `getAiConfig(user.id)` with a key+model or 400, `getProject` + ownership (404). Load `getPlan(projectId) ?? minimalPlan()`. One call: `const result = streamText({ model: provider.chat(config.model), system: buildDecisionsRefinePrompt(planText(plan), instruction), messages: [{ role: "user", content: "Rewrite the decisions now." }], abortSignal: request.signal }); const text = await result.text;`. Then `const next = parsePlan(text).decisions;` and `const merged = mergeDecisions(plan, next);`; if `next.length === 0`, return `400 { error: "AI tidak mengembalikan keputusan" }` **without saving**; otherwise `savePlan(projectId, merged)` and return `Response.json({ decisions: merged.decisions })`. Wrap the AI call in try/catch → `500 { error }` on failure, plan untouched.

- [ ] **Step 7: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint lib/plan.ts tests/plan.test.mjs app/actions.ts "app/api/prd/decisions/route.ts"`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add lib/plan.ts tests/plan.test.mjs app/actions.ts "app/api/prd/decisions/route.ts"
git commit -m "feat: persist and AI-rewrite plan decisions"
```

---

### Task 3: Review UI in `components/decision-panel.tsx`

**Files:**
- Modify: `components/decision-panel.tsx`
- Modify (only if needed to pass props): `app/projects/[id]/editor.tsx` (the `<DecisionPanel … />` call)

**Interfaces:**
- Consumes from Task 2: `saveDecisionsAction`, `POST /api/prd/decisions`.
- Props stay `{ plan: Plan | null; onRerun: () => void }`. Local decision state is seeded from `plan` once; the panel is self-contained afterwards.

- [ ] **Step 1: Add the review toggle + per-decision editing**

Keep the `Card`/title. Add a **Review**/**Tutup** button in the header (mirror the section toggle). Seed `useState<Decision[]>` from `plan.decisions`. When open, render per decision: its `label` and `question`, a radio group built from `options` (the one equal to `recommended` labelled `"… (Rekomendasi)"`), and an "other" text input; a radio/input is selected when `chosen` equals it, and a `chosen` that matches no option selects the free-text input with that value. Track `dirty`.

- [ ] **Step 2: Wire Save**

A **Simpan keputusan** button calls `saveDecisionsAction(project.id, decisions)` (client import from `@/app/actions`), disabled while `!dirty` or saving; on success clear `dirty` and toast success; on failure toast the error message. Follow the `Loader2`/spinner pattern used elsewhere.

- [ ] **Step 3: Wire the AI rewrite**

A **"Minta ubah lewat AI..."** `Input` + **Minta ubah** button `POST`s `/api/prd/decisions` with `{ projectId, instruction }`. On `200`, replace local decisions with the response's `decisions` and mark `dirty` (so Save persists) — or Save automatically; pick one and keep it consistent. On non-200, toast the error and leave local decisions unchanged. Disable the input/button while the request is in flight.

- [ ] **Step 4: Gate "Buat ulang" on dirty**

While `dirty`, disable the existing **Buat ulang** button and show the hint `"Ada perubahan belum disimpan."`; after a successful save, show `"Tekan Buat ulang untuk menerapkan ke PRD."`.

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint components/decision-panel.tsx "app/projects/[id]/editor.tsx"`
Expected: clean.

- [ ] **Step 6: Manual check (Review Focus 1, 3, 4)**

On a project with a plan: open Review, pick another option → Simpan → confirm; type a free-text value not in the options → Simpan → **reload** and confirm it is still shown as `chosen`; press **Minta ubah lewat AI** with an instruction and confirm the panel updates and survives a reload; confirm **Buat ulang** is disabled while dirty and enabled after saving. (Requires a live OpenAI-compatible endpoint; if none is available, say so and record it as unrun rather than claiming a pass.)

- [ ] **Step 7: Commit**

```bash
git add components/decision-panel.tsx "app/projects/[id]/editor.tsx"
git commit -m "feat(ui): review and edit decisions in place"
```

---

## Self-Review

- **Spec coverage:** goals (T1–T3), Review toggle + per-decision editing (T3), free-text value (T2 `mergeDecisions`/`normalizeDecision`, T3), "Minta ubah lewat AI" endpoint + prompt (T1, T2), persist via `savePlan` with no new column (T2), Buat ulang re-drafts from the updated plan (T3, existing `runPrd(true)`), non-goals respected (no category/assumption editing). No spec requirement without a task.
- **Type consistency:** `buildDecisionsRefinePrompt(planText, instruction)` (T1) consumed in T2's route. `mergeDecisions(plan, next): Plan` (T2) used by the route. `saveDecisionsAction(projectId, decisions)` (T2) called in T3. `Decision`/`Plan` come verbatim from `lib/plan.ts`.
- **Placeholders:** none; every step names a file, a signature, or a test with its assertions.
- **Review Focus:** each of the five lines names the task that owns its check (T3, T2, T2/T3, T3, T2).
