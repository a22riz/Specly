# Specly Rebuild — One-Shot Domain PM

**Date:** 2026-11-05
**Status:** Proposed (awaiting approval)
**Approach chosen:** A — one-shot domain PM (reuse infra, rebuild the experience)

## Intent

Specly stops being "chat a lot, then edit 12 forms". It becomes an AI product
manager: the user describes an idea once, the AI recognizes the app category and
industry, drafts a **complete** PRD in a single streaming pass, and surfaces only
the few decisions that genuinely need the user. The output is still a PRD.md +
AGENTS.md + CARA_PAKAI.md ZIP for a coding agent.

Why now: the current flow is long (≈2–4 min, 12 sequential sections), interrogative
(AI asks instead of recommending), domain-blind (no knowledge of app categories),
and form-heavy (12 editable textareas + settings).

## Goals

- **Minimal input.** One free-text description is enough. No questionnaire.
- **Domain-aware.** The AI classifies the idea and inherits category defaults
  (users, entities, must-have features, edge cases, industry concerns).
- **One-pass draft.** All 12 sections are produced without a separate prompt loop.
- **Decisions, not questions.** Uncertainties become "Perlu keputusan" chips the
  user accepts (default) or changes with one action. Accepted → concrete text.
- **Fast.** Cut wall-clock time for a full draft (parallel sections).
- **Conversational refinement** after the draft, per section or overall.

## Non-Goals

- No change to auth, SQLite engine, export formats, or deployment topology.
- Still a single `prd` pack (no additional document types).
- No real-time multi-user editing / collaboration.

## Anti-Goals (failure even if it "works")

- The primary surface becoming a wall of editable forms again.
- Blocking the PRD on unanswered questions — always emit a complete draft with
  labeled assumptions.
- Inventing product-specific facts (real names, prices, numbers, legal details).

## Constraints

- Next.js 16 App Router, `output: "standalone"`, SQLite (better-sqlite3).
- `@ai-sdk/openai` `provider.chat` only (OpenAI-compatible endpoints, user BYOK).
- Indonesian conversation/UI; English document content inside one `<content>` block
  per section (`extractContent` stays the parsing contract).
- No new dependency without strong justification.
- `lib/prompts.ts` remains the single source of truth for prompts.

## What Is Reused vs Rebuilt

- **Reused:** Next.js shell, auth + multi-user, SQLite + `sections`/`messages`/`users`
  tables, SSE helpers (`lib/sse.ts`), export (`lib/render.ts`, `app/api/export`),
  `APP_PLAYBOOK`, `extractContent`/`conversationText`, design system tokens.
- **Rebuilt:** the request pipeline in `app/api/prd`, the prompt set (plan-driven),
  the project page flow + editor UI, and the source of "questions" (plan decisions).

## Architecture

### New flow

1. **New project** dialog: one textarea *"Ceritakan aplikasimu sebanyak yang kamu mau"*
   + title input (auto-derived from the first line if left empty). Submit → create
   project, store the description as the first `messages` row, navigate to the project.
2. **Project page auto-runs the draft** when the project has no content yet
   (no separate "Buat PRD" click for the first run; the button remains as "Buat ulang").
3. **Write pipeline** (`POST /api/prd`, reworked):
   - **Phase 1 — plan** (one short LLM call, JSON): classification + per-section
     one-line outline + `assumptions[]` + `decisions[]`.
   - **Phase 2 — draft** (12 sections): run with bounded concurrency (default 4). Each
     section prompt receives the **plan** (not prior sections) as shared context, so
     parallel output stays consistent. Streams the existing SSE events
     (`section_start`, `chunk`, `section_done`, `error`, `done`).
   - Persist every section as it finishes (`saveSection`).
4. **Decisions panel:** the plan's `decisions[]` render as chips. Each chip: a
   recommended option (default selected) plus alternatives. Accept → recorded; change
   → the affected section(s) are rewritten via the refine endpoint.
5. **Editor = document-first:** sections render as readable cards with status
   (`Terisi` / `Perlu keputusan`); inline edit is opt-in. A chat box drives
   conversational refinement ("ubah seksi X jadi …").
6. **Refine endpoint** (`POST /api/prd/refine`): rewrite one or more sections from a
   plain-language instruction + current content + plan; streams + persists.

### Prompts (`lib/prompts.ts`)

- `buildPlanPrompt(projectTitle, description)` → strict JSON:
  `{ category, industry, scale, platform, decisions: [{ id, label, question, recommended, options? }], assumptions: [{ id, label, note }], outline: { [sectionKey]: string } }`.
  Uses `APP_PLAYBOOK`.
- `buildSectionFromPlanPrompt(section, plan, description)` → one `<content>` block in
  English, grounded in the description + plan; gaps filled with category defaults
  marked `[ASSUMPTION: …]`; `[NEEDS CLARIFICATION: …]` reserved for what only the user
  can decide.
- `buildRefinePrompt(section, instruction, currentContent, plan)` → rewritten
  `<content>` block.
- `buildExplorePrompt` is **repurposed** as the refinement chat prompt (recommendation-
  first, Indonesian, no document output).
- `buildWriteSectionPrompt` is superseded by `buildSectionFromPlanPrompt`
  (kept only if still referenced; otherwise removed and its test updated).
- `buildPrdContext` unchanged (grounds refine/chat).

### Data model (`lib/db.ts`)

- Add one column `projects.plan_json TEXT` via the existing migration guard.
  Stores classification + decisions (with chosen/status mutated) + assumptions +
  outline. One column — no new table (ponytail; split out only if queried per-decision).
- Accessors: `getPlan(projectId)`, `savePlan(projectId, plan)`, `setDecision(projectId, id, chosen)`.
- `sections`, `messages`, `users`, `ai_config` unchanged.

### API surface

- `POST /api/prd` — reworked: plan → parallel draft → persist → SSE. `force` re-drafts.
- `POST /api/prd/refine` — section rewrite(s) from an instruction.
- `POST /api/chat` — refinement conversation (explore prompt repurposed).
- Unchanged: `/api/export`, auth routes.

### UI

- `components/project-list.tsx`: new-project dialog becomes description-first.
- `app/projects/[id]/editor.tsx`: document-first layout — PRD cards (status badges,
  opt-in edit) + `Perlu keputusan` panel + refinement chat. Reuses the progress UI.
- Home hero + `CARA_PAKAI` copy updated to the new promise ("ceritakan sekali, dapat
  PRD lengkap, tinggal putuskan beberapa hal").

## Trade-offs Recorded

- **Parallel sections lose the sequential "see prior sections" consistency.** Mitigated
  by making the shared **plan** the consistency anchor. Concurrency bounded (default 4)
  to respect provider rate limits.
- **Plan JSON can be malformed.** Mitigate with a tolerant parser (strip fences,
  fall back to a minimal plan and continue with defaults) + a unit test.
- **Auto-run on first visit** adds an autoplay behavior; acceptable because it is the
  whole point (no click friction). Guarded so it never re-runs over existing content.

## Build Order (each step a vertical slice, verified)

1. `plan_json` column + `lib/db.ts` accessors (+ test).
2. `buildPlanPrompt` + tolerant plan parser (`lib/prd.ts`) + tests.
3. `buildSectionFromPlanPrompt` / `buildRefinePrompt` + tests; retire old write prompt.
4. Rework `POST /api/prd`: plan → bounded-concurrency draft → progress events.
5. Project page: auto-run on empty + `Perlu keputusan` chips (accept/change).
6. `POST /api/prd/refine` + repurpose chat for refinement.
7. Editor document-first redesign + copy updates (home, CARA_PAKAI).
8. Full verify: `tsc`, `eslint`, all tests, manual end-to-end with a real endpoint.

## Left to the Builder

- Concurrency limit + provider rate-limit/backoff handling.
- Exact decision-chip UX (single-select vs free-text "other").
- Whether refine targets one section or a dependency set.
- Migration copy for existing projects that already have sections but no plan
  (plan optional for those).
