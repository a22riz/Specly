# Specly — Discovery Gate (short guided discovery before the PRD)

**Date:** 2026-11-05
**Status:** Approved (2026-11-05) — with the design & quality bars below.
**Approach chosen:** A — discovery is a chat whose assistant turns are structured JSON; answers persist in the existing `messages` table; the existing plan → parallel-draft pipeline runs after discovery completes.

## Intent

Bring back a real discovery step, but make it **short, effortless, and guided**. Today the PRD auto-drafts straight from the one-line description, so the AI sometimes guesses what the user meant. Discovery returns as a **gate**: the AI asks a handful of questions — each with recommended answers the user can click — and only when it understands the idea does the PRD get written.

Why now: the user wants to be understood before a document is produced, without the old long interview. Two dials make that cheap: every question ships with recommendations (usually one click to answer), and the AI decides how many questions it needs, capped at 8.

## Goals

- **Gate, not decoration.** No PRD is drafted until discovery is complete.
- **Recommendation-first questions.** Each AI question carries 2–4 answer options, the recommended one first; the user can click or type their own.
- **AI-decided length, hard cap 8.** Adaptive: a crisp idea finishes in 1–2 questions, a raw idea takes more. 8 is a safety ceiling, never a target.
- **Always escapable.** A "Cukup, lanjut" button lets the user stop early and draft immediately.
- **One place for decisions.** Discovery is the only place choices are made. After the PRD exists, the decision panel is a read-only summary + **Buat ulang**.
- **Reuse the existing pipeline.** No new dependency; plan → parallel draft → refine stay as they are.

## Non-Goals

- No change to auth, SQLite engine, export formats, or deployment topology.
- No change to the 12 `PRD_SECTIONS`, the plan parser, `mapLimit`, or the refine endpoint.
- No user-facing setting for the question count (the AI decides; 8 is a constant ceiling).

## Anti-Goals (failure even if it "works")

- Discovery becoming an interrogation again (open questions, no recommendations, many rounds).
- Blocking forever: the user must always be able to end discovery and get a PRD.
- A question whose answer the AI could have defaulted instead of asking.
- Two places asking the same decision (discovery and the panel).

## Constraints

- Next.js 16 App Router, `output: "standalone"`, SQLite (better-sqlite3).
- `@ai-sdk/openai` `provider.chat` only (OpenAI-compatible endpoints, BYOK).
- Indonesian conversation/UI; English document content inside one `<content>` block.
- `lib/prompts.ts` stays the single source of truth for prompts.
- No new runtime dependency.

## What Is Reused vs Rebuilt

- **Reused:** the `messages` table (one conversation per project), `app/api/chat` guards + streaming, `POST /api/prd` (plan → parallel draft), `POST /api/prd/refine`, `APP_PLAYBOOK`, `lib/plan.ts`, `extractContent`, design tokens.
- **Rebuilt:** the explore prompt becomes a **discovery** prompt with a structured turn contract; the editor's chat card becomes the discovery card; the decisions panel loses its editing role; `shouldAutoRun` gains a `discoveryDone` condition.
- **Added:** one `projects.discovery_done` column, a tolerant discovery-turn parser, a transcript renderer that turns assistant JSON turns into readable text for the plan prompt.

## Approaches Considered

- **A (chosen) — structured JSON chat, answers in `messages`.** Least new surface; consistent with the repo's one-conversation-per-project model; the existing plan call already reads the transcript, so it consumes the answers for free.
- **B — separate `discovery_json` object.** More explicit, but creates a second source of context next to `messages`; rejected as redundant.
- **C — discovery mutates the plan incrementally.** Fewest AI calls, but fragile (incremental parsing) and risks losing the transcript the refine prompt relies on; rejected.

## Architecture

### New flow

1. **New project** dialog: description → project + first `messages` row (role `user`), navigate to the project. The description becomes **required** (title stays optional, derived); a title-only project has nothing to seed discovery with.
2. **Discovery phase** (new, replaces the direct auto-draft): if the project has no content and `discovery_done` is false, the page auto-starts discovery and asks question 1. The user answers (chip or free text) → next question → … until the AI returns `done: true`, or the user presses **Cukup, lanjut**, or 8 questions have been asked.
   - Question 1 has no new user turn to send (the description is already persisted), so the client calls the discovery endpoint with **no `message`**; the endpoint asks the AI for the next turn from the existing history.
3. **Hand-off:** on completion the client calls `finishDiscoveryAction(projectId)` (marks `discovery_done`), then runs the existing draft (`POST /api/prd`).
4. **Write pipeline** (unchanged): plan call → 12 sections in parallel (`mapLimit`) → persist → SSE.
5. **Editor after discovery:** the card shows a short recap of the idea + the PRD button (`Buat PRD` / `Buat ulang`) with the progress UI. Sections render as before, plus per-section **"Minta ubah lewat AI"** (refine).
6. **Decision panel (new role):** read-only summary of the plan's decisions (label + chosen/recommended value) plus **Buat ulang**. No chips to change — choices were made in discovery.

### Discovery turn contract

Each assistant reply during discovery is one JSON object:

```json
{
  "say": "string (short Indonesian prose, optional)",
  "question": { "text": "string", "options": ["recommended", "alt1", "alt2"] } ,
  "done": false
}
```

- `options` holds 2–4 strings; **the first is the recommendation** (the UI labels it "Rekomendasi").
- `done: true` means discovery is over; `question` is then absent.
- If the reply is not valid JSON, the tolerant parser treats the whole text as a `say` with no question and `done: false`; the user can still type an answer or press **Cukup, lanjut**. Discovery must never dead-end on a parse failure.

Parser + progress live in a new pure module `lib/discovery.ts` (`parseDiscoveryTurn`, `canAskMore(count, max)`), covered by `tests/discovery.test.mjs`.

### Prompts (`lib/prompts.ts`)

- `buildExplorePrompt` → **`buildDiscoveryPrompt(projectTitle, prdContextMd, askedCount, max)`**:
  - Recommendation-first, Indonesian, uses `APP_PLAYBOOK`, never writes document content.
  - Must classify the idea, ask only what it cannot sensibly default, and return the JSON turn contract above.
  - Told the cap (`max = 8`) and how many it has asked, and that it should set `done: true` as soon as it understands the idea.
- `buildPlanPrompt`, `buildSectionFromPlanPrompt`, `buildRefinePrompt` unchanged in shape, but `buildPlanPrompt` must now **mirror the user's discovery choice into `chosen`**: it reads the same transcript (which now carries the discovery answers) and sets each decision's `chosen` to the value the user actually picked, not the recommended default.
- `normalizeDecision` (in `lib/plan.ts`) relaxes: keep `chosen` verbatim when present — including a free-text answer that is not one of the options — and only fall back to `recommended` when `chosen` is missing. (Today it forces `chosen` back to `recommended` when it is not in `options`, which would silently drop a free-text discovery answer.)

### Data model (`lib/db.ts`)

- Add `projects.discovery_done INTEGER NOT NULL DEFAULT 0` via the existing `PRAGMA table_info` guard. In the same "column was just added" branch, run a one-time `UPDATE projects SET discovery_done = 1`, so **every pre-existing project skips the gate** (covers both projects with sections and old projects that only have an explore-chat transcript). Only projects created after the change start at 0.
- Accessors: `isDiscoveryDone(projectId): boolean`, `markDiscoveryDone(projectId): void`.
- `messages`, `sections`, `plan_json`, `users`, `ai_config` unchanged.
- The discovery card only shows when `!hasContent && !isDiscoveryDone`.

### API surface

- `POST /api/discovery` — the discovery turn (renamed from `/api/chat`): guards and streaming unchanged; body `{ projectId, message? }`. When `message` is present it is persisted first; when absent (question 1), the AI is asked for the next turn from the existing history. The system prompt is `buildDiscoveryPrompt`. The assistant JSON is persisted on end (drain-on-end kept).
- `app/actions.ts` — add `finishDiscoveryAction(projectId): Promise<void>` (ownership-checked, calls `markDiscoveryDone`).
- `POST /api/prd` — (a) build its prompt input through the new transcript renderer (replace the inline `getMessages().map(...).join` so the plan/section prompts see readable prose, not raw assistant JSON); (b) add a server guard: when `!isDiscoveryDone && !force` return **409 with a distinguishable body** (`{ error, reason: "discovery" }`) so the client does not confuse it with the existing content-exists 409 (`reason: "content"`, which opens the "Timpa PRD?" dialog). `force` (Buat ulang) stays allowed.
- `POST /api/prd/refine`, `/api/export`, auth routes — unchanged.

### UI

- `app/projects/[id]/editor.tsx`:
  - Discovery card (shown while `!hasContent && !isDiscoveryDone`): current question, option chips (first = "Rekomendasi"), a free-text box, a progress line ("Pertanyaan N · maks 8"), a send button, and **Cukup, lanjut**.
  - On completion: `finishDiscoveryAction` then `runPrd(false)`.
  - `shouldAutoRun` gains a `discoveryDone` argument (`aiReady && !hasContent && !alreadyStarted && discoveryDone`), so the draft auto-runs only after discovery.
  - Transcription renderer: assistant messages are stored as JSON; one renderer turns a turn into readable prose for the prompt transcript, and `/api/prd` is rewired to use it (replacing the inline join). `conversationText` — today used only by tests — becomes the basis for this renderer.
- `components/decision-panel.tsx`: renders the plan's decisions read-only + **Buat ulang**; chips no longer editable.
- Copy: home hero + `CARA_PAKAI_MD` mention the short discovery step.

## Trade-offs Recorded

- **JSON-per-turn adds a parse step.** Mitigated by a tolerant parser that degrades to a plain conversational turn; discovery can always be ended manually.
- **The gate delays the first PRD.** Intended: the user chose understanding before output. The **Cukup, lanjut** button bounds the delay.
- **The decision panel loses in-place editing.** Intended: choices now happen in discovery; later changes go through "Minta ubah lewat AI". `setDecision`/`setDecisionAction` may become dead code (builder to confirm and remove or keep).
- **Cap 8 is a soft ceiling enforced by the prompt + the UI counter.** A malformed or stubborn model could exceed it; the UI stops offering new questions at 8 and forces hand-off.

## Build Order (each step a vertical slice, verified)

1. `lib/discovery.ts` (`parseDiscoveryTurn`, `canAskMore`) + `tests/discovery.test.mjs`.
2. `buildDiscoveryPrompt` in `lib/prompts.ts` + test assertions; retire/rename `buildExplorePrompt`.
3. `projects.discovery_done` column + one-time backfill + `isDiscoveryDone`/`markDiscoveryDone` + test.
4. `finishDiscoveryAction` + `/api/discovery` (renamed `/api/chat`, optional `message`) + `/api/prd` 409 guard with `reason`.
5. Transcript renderer for JSON turns (used by `/api/prd`) + `shouldAutoRun(..., discoveryDone)` + `normalizeDecision` relaxation + `buildPlanPrompt` mirrors the chosen answer + tests.
6. Editor discovery card + hand-off to draft; `DecisionPanel` read-only; client branches the two 409 reasons.
7. UI/UX polish on the discovery card + draft progress: animated progress bar, shimmer skeletons, estimated time remaining (labeled "perkiraan"), discovery typing indicator; section toggle "Sunting" → "Review" (`editor.tsx:642`, hint at `:614`).
8. Copy (home hero, `CARA_PAKAI_MD`, `AGENTS.md`); create dialog requires a description.
9. Full verify: `tsc`, `eslint`, all test suites, manual end-to-end against a real endpoint.

## Calls I Made (from the builder check)

These were open in the first draft; each is settled as the builder's call — check them while reading.

1. **How discovery turn 1 is generated:** the discovery endpoint accepts an **optional** `message`; called with none, it asks the AI for the next turn from existing history. Question 1 therefore needs no synthetic user turn, and the description is not duplicated.
2. **Discovery answers vs `plan.decisions[].chosen`:** the plan call must reflect the user's actual choice. `buildPlanPrompt` mirrors it into `chosen`, and `normalizeDecision` keeps `chosen` verbatim (including free-text) instead of forcing it back to `recommended`. The read-only panel then shows what the user chose, not the default.
3. **The transcript the plan reads:** `/api/prd` is rewired to build its prompt input through the transcript renderer, so assistant JSON turns are rendered as readable prose rather than passed raw.
4. **Projects with an old transcript and no sections:** the migration backfills `discovery_done = 1` for every pre-existing project, so they never enter the gate.
5. **Two different 409s from `/api/prd`:** the response carries a `reason` (`"discovery"` vs `"content"`); the client shows "Selesaikan diskusi dulu" for the former and the "Timpa PRD?" dialog only for the latter.

## Design & Quality Bars (added on approval)

1. **Implementing agents use the right skills.** Each implementation/review subagent loads its relevant skills explicitly:
   - Coding discipline (always): **`ponytail`** (the laziness ladder — smallest change that fully solves it) and **`test-driven-development`**.
   - UI design + implementation: **`ui-ux-pro-max`** (direction source; `design-system/specly/MASTER.md` already exists and is authoritative) with **`ui-styling`** (shadcn/Base UI + Tailwind 4) and **`hallmark`** for the new discovery surface.
   - Copy/prose (Indonesian UI strings and guide text): **`humanizer`** + **`antislop-copywriting`**, under the **`antislop`** core filter.
   - Accessibility & mobile: **`antislop-human`**, **`antislop-layoutmobile`**.
   - Process/review: **`subagent-driven-development`**, **`code-review`**, **`verification-before-completion`**.
2. **Better UI/UX.** The discovery card is the main new surface; make it feel designed, not generated (`hallmark`), and follow `MASTER.md` tokens (primary `#D946EF`, CTA `#EA580C`, Rubik headings / Nunito Sans body, 150–300ms transitions, `cursor-pointer`, visible focus, `prefers-reduced-motion`). Keyboard-operable chips; free-text always reachable.
3. **Code to best practice.** Follow `ponytail`: stdlib/native/existing deps first, no new dependency, no speculative abstraction; mark deliberate simplifications with `shortcut:` comments naming the ceiling and upgrade path.
4. **Loading feedback with estimates.** During discovery and drafting, show progress **and** an honest rough estimate:
   - Draft: section progress (`N/12`) plus an estimated time remaining derived from observed per-section duration, clearly labeled "perkiraan", with an animated progress bar and shimmering section skeletons. No fake precision; if the estimate is unknown yet, say so.
   - Discovery: a typing indicator while the AI composes the next question; the "Pertanyaan N · maks 8" counter stays visible.
5. **Copy change.** The section-card toggle currently labeled **"Sunting"** (`editor.tsx:642`) becomes **"Review"** (and the surrounding hint at `editor.tsx:614` reworded to match). Keep it Indonesian.

## Left to the Builder

- Exact chip styling and whether the free-text box is always open or behind "jawab sendiri".
- Whether **Cukup, lanjut** is visible from question 1 or appears from question 2.
- Whether the 8-cap is also a hard server clamp (server refuses to ask a 9th) or prompt + UI only.
- The exact readable rendering of an assistant JSON turn in the transcript.
- Removal (or retention) of the now-unused `setDecision`/`setDecisionAction`.
