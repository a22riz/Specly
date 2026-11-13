# Specly — PRD Review Pass (the "Goldfish" step)

**Date:** 2026-11-13
**Status:** Approved (2026-11-13)
**Approach:** A (agreed) — **one** AI call reads the plan + all 12 sections and returns one `findings[]`. Each finding is routed by evidence (does it cite a rule and pass a deterministic verifier?) and by an AI-assigned `weight` (does the user need to decide?): provable → auto-fix; non-provable `high` → escalation (decision); `medium`/`low` → note. The user presses one button; that press is the consent.

## Intent

After the 12 sections are drafted, nothing reads them **together**. Each section is written in isolation (only the plan + the raw description), so drift between sections — a renamed entity, a Non-Goal restated as a feature, a scenario pointing at no story — survives into the export and misleads the coding agent.

Close that gap with a **review pass**, modelled on the Elephant-Goldfish split we studied: the section drafts are the "Elephant" (they hold context and write), the reviewer is the "Goldfish" (it looks at the finished document with fresh eyes). Fresh context is already free here — the reviewer sees only the plan and the sections, never the chat. The one genuinely new thing is that a single call now considers **all 12 sections at once**.

Borrowed from [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model) (Apache-2.0) as **patterns only** — no install, no dependency, no new runtime.

### Rubric — what "good" means (the four objectives)

The review judges every section against these, in order:

1. **Faithful to the user.** No claim, requirement, or entity that contradicts the plan's chosen decisions or the user's description.
2. **Not over-engineered.** No invented scope, no feature the plan did not call for, no implementation detail (frameworks, APIs, code) leaking into content.
3. **Best practice.** The PRD structure holds: stories have IDs and acceptance scenarios, scenarios name the story they verify, FRs trace to a story, every section is complete (no bare headings / TODOs).
4. **Cheap.** One call, no loop, and the token cost is visible to the user.

## The two boundaries (why A is safe)

A is a single call that writes, so two questions decide everything: **is the finding provable?**, and **is it heavy enough to need the user?** Both are answered structurally, not by trust.

### Boundary 1 — an auto-fix must be provable against the canon

> **A fix may only bring content in line with something that already exists. It always cites what authorises it, and it is always reversible.**

**Tier 1 — align (changes no meaning):**

- Replace a non-canonical entity/role/glossary term with the canonical name from `plan.terminology`.
- Repoint a broken reference ID (a scenario whose `US-n`, or an FR whose `US-n`, does not exist) **when exactly one target fits**.
- Normalise a section heading to exactly `### <enTitle>`.

**Tier 2 — remove/relocate, but only when the canon authorises it (the "slightly more aggressive" allowance):**

- Drop an out-of-scope item (FR/goal/feature) that restates an explicit Non-Goal or contradicts a chosen decision — the fix **must name** that Non-Goal/decision.
- Drop a dangling reference when no unique target exists (Tier 1 handles the repoint case).
- Collapse an exact duplicate (the same requirement/id stated twice).
- Strip invented implementation detail (framework/API/code), per the explicit "never invent implementation details" rule — replaced by `[ASSUMPTION: …]` or removed.

Every fix carries a `rule` (a `CONSISTENCY_RULES` clause, an entry of `plan.terminology`, a Non-Goal, a chosen decision, or a duplicate it matches). **No rule ⇒ not a fix.** Tier 2 removals additionally return `removed` (the discarded text) so undo restores it intact, and the UI names the authorising rule. "Inventing" stays structurally impossible: the model can never add content, only align or discard against an existing rule.

### Boundary 2 — the AI weighs which findings reach the user

Escalating everything floods the user; escalating nothing ships errors. The AI assigns each **non-provable** finding a `weight` — its impact on what the coding agent will build:

- `high` — left alone, the coding agent builds the wrong product or contradicts the user's intent.
- `medium` — a real defect, but self-contained and not intent-dependent.
- `low` — cosmetic/style; harmless if left.

| Finding | Action |
|---|---|
| Provable (has `rule`, passes the verifier) | **auto-fixed** at any weight (weight only orders display) |
| Not provable · `high` | **escalation** — becomes a decision the user answers (options + recommendation required) |
| Not provable · `medium` | **note** — visible but collapsed; no decision requested |
| Not provable · `low` | note — collapsed, counted only |

So weight never blocks a provable fix — it decides only which judgment calls reach the user. The two fears ("too aggressive" / "too many questions") are both held by one rule: **evidence first, weight second.**

**Guard against a hidden finding:** nothing is ever dropped silently. Every finding is returned and counted, so the summary always reads *"N dirapikan · K dihapus · M perlu keputusanmu · J catatan"*. A `high` must quote **what it changes in the build** ("FR-4 forces an offline mode nobody asked for"); without that justification it degrades to a note. `medium`/`low` notes live behind a *"buka catatan"* toggle, and any note can be promoted to a decision by hand.

## Goals

- **One button, one call.** "Tinjau PRD" runs the pass; nothing runs automatically (BYOK — the user pays, so the user triggers).
- **Fixes are provable.** Every applied fix must cite the exact rule it aligns to (Tier 1 or Tier 2), and pass a deterministic verifier before it is saved.
- **The AI weighs what reaches the user.** Each non-provable finding gets a `weight`; only `high` becomes a decision, `medium`/`low` stay as notes. "Human in the loop only when needed."
- **Escalations reuse the decision panel.** Findings the AI must not decide become decisions (label + question + options + recommendation).
- **Nothing is hidden.** Every finding is returned and counted; notes are one click away and can be promoted to a decision.
- **Visible and reversible.** The user sees the counts and each fix's before/after (plus any `removed` text), and can undo.
- **Cost is shown.** Input and output tokens of the review call are displayed.
- **No new table, no new dependency.** Reuse `plan_json`, `sections`, `saveSection`, `mergeDecisions`, `DecisionPanel`.

## Non-Goals

- No change to discovery, the plan call, the parallel draft, `buildRefinePrompt`, export, or auth.
- No multi-lens reviewers (approach B) and no review→fix→re-review loop (approach C). Both can be added later on top of A.
- No new DB table or column.
- No auto-run. The pass never fires on PRD completion.

## What Is Reused vs Added

- **Reused:** `PRD_SECTIONS`, `CONSISTENCY_RULES`, `planText`, `APP_PLAYBOOK`; `getPlan`/`getSections`/`savePlan`/`saveSection`/`getOwnedProject`; `mergeDecisions`/`normalizeDecisions`; `saveSectionAction`; `DecisionPanel`; the GET/POST route guard shape; the SSE-free JSON response style of `/api/prd/decisions`.
- **Added:** `buildReviewPrompt` in `lib/prompts.ts`; `lib/review.ts` (tolerant parse + deterministic verifier + weight router + escalation→decision mapping); `POST /api/prd/review`; a "Tinjau PRD" button + result card (counts, notes toggle, undo) in `editor.tsx`; `tests/review.test.mjs`.

## Architecture

### Flow

1. PRD exists (`hasContent`). The editor shows **Tinjau PRD** next to *Buat ulang*.
2. The user presses it — that press is the consent (it will spend tokens and may rewrite sections). A short confirm states both.
3. `POST /api/prd/review { projectId }`:
   - Guards: session, ownership, AI config, `hasContent` (nothing to review otherwise).
   - Builds one prompt: `planText(plan)` + the 12 sections (filled ones; empty ones listed as empty).
   - One `streamText` call, non-streamed response (`.text`), returning JSON.
   - `parseReview(text)` → `findings[]` (tolerant; malformed → empty, never throws).
   - Route each finding: `rule` + verifier pass → **fix** (`saveSection`); else `weight: high` + options → **escalation**; else **note**.
   - `mergeDecisions(plan, escalationsAsDecisions)` → `savePlan`.
   - Respond `{ applied, escalated, notes, decisions, usage }` — `applied` carries `key`, `issue`, `rule`, `before`, `removed`, `after`.
4. The editor shows **"N dirapikan · K dihapus · M perlu keputusanmu · J catatan"**, each applied fix expandable to before/after (plus `removed`), notes behind a toggle, plus **Batalkan perbaikan**. Escalations are already in `plan.decisions` → `DecisionPanel` renders them.
5. The user answers escalations in the panel and, as today, presses **Buat ulang** to apply them. (Reusing the existing re-draft keeps the change small; a targeted per-section apply can come later.)

### The review contract (`lib/review.ts`)

One `findings[]` array; the route does the routing, not the prompt.

```json
{
  "findings": [
    {
      "section": "prd.entities",
      "weight": "high | medium | low",
      "issue": "Used 'Item' where the canonical entity is 'Produk'.",
      "rule": "canonical name: Produk",
      "from": "Item",
      "to": "Produk",
      "revisedContent": "<full replacement markdown for this section>",
      "removed": "<text discarded, Tier 2 only>",
      "options": ["…", "…"],
      "recommended": "…"
    }
  ]
}
```

Routing in `POST /api/prd/review`:

- `rule` present **and** verifier passes → **apply** (`saveSection`); any weight.
- else `weight === "high"` **and** `options` non-empty → **escalation** → `mergeDecisions` (fresh id `R1…`, `question = issue`, `recommended` echoed as `options[0]` so the panel shows "(Rekomendasi)").
- else → **note** (returned, collapsed, no decision).

A `high` with no options, or a fix that fails the verifier, degrades to a note — never an error.

### The verifier (deterministic, no AI)

A fix is applied only if **all** hold; otherwise it degrades to a note:

- `key`/`section` ∈ `PRD_SECTIONS`; `revisedContent` non-empty; `revisedContent !== before` (a no-op is noise).
- **Heading preserved:** if `before` starts with `### X`, `revisedContent` starts with `### <enTitle>`.
- **IDs:** every ID in `before` (`/\b(?:US|FR|AS|NFR)-\d+\b/g`) must survive — **except** for a Tier 2 removal, which may drop an ID only when it declares `removed` (the discarded text), cites a non-empty `rule`, and `revisedContent` no longer contains that `removed` text. Any other dropped ID = reject.
- **Canonical term present:** when the `rule` cites a canonical name, `to` appears in `revisedContent`.

`shortcut:` the verifier trusts the `rule` citation for a Tier 2 removal rather than re-deriving it from the plan; the citation and the `removed` text are shown in the UI and the removal is undoable. Upgrade path: validate the `rule` against the plan's Non-Goals / chosen decisions.

These checks catch the realistic failure — a rewrite that drops an ID or a heading, or a deletion that cites nothing and shows nothing — without a second AI call.

### Prompt (`lib/prompts.ts`)

`buildReviewPrompt(projectTitle: string, plan: Plan, sections: { key: string; content_md: string }[]): string`

- Role: a reviewer with fresh eyes on a finished PRD; it did **not** write it and has no chat history.
- Injects the **rubric** (the four objectives), `CONSISTENCY_RULES`, canonical terminology via `planText(plan)`, and `APP_PLAYBOOK`.
- Hard rules:
  - Report only. Rewrite a section only for the Tier 1/Tier 2 classes above; everything else is a finding with a `weight`.
  - Every fix cites `rule`; no rule ⇒ do not rewrite — report it and weigh it.
  - **Weigh each non-provable finding** `high|medium|low` by its impact on what the coding agent will build, and state what a `high` changes in the build.
  - A `high` needs real `options` + `recommended` (a decision the user can act on).
  - Tier 2 removals must name the Non-Goal/decision/duplicate that authorises them and return `removed`.
  - Never invent product facts or implementation detail; never delete a story, requirement, or scenario without a Tier 2 basis.
  - Prefer a short list over padding — do not manufacture findings; `low` noise is still counted, so do not inflate it.
  - Reply with ONLY the JSON object above; no prose, no fences.
- Skips empty sections.

### UI (`editor.tsx`, `DecisionPanel`)

- **Tinjau PRD** in the PRD card (shown when `hasContent && !generating`). Confirm: "Meninjau PRD memakai token AI dan dapat merapikan atau menghapus bagian tertentu secara otomatis.".
- While running: a spinner + "Meninjau PRD…"; the button is disabled.
- Result card: `N dirapikan · K dihapus · M perlu keputusanmu · J catatan`, a token line from `usage`, a `<details>` per applied fix (before/after, with the authorising rule and any `removed` text), a **"buka catatan"** toggle for `medium`/`low`, and **Batalkan perbaikan**.
- Toasts in Indonesian; `sonner` as everywhere else.
- Escalations need no new UI — `DecisionPanel` already lists them (new ids, "(Rekomendasi)" on option[0]).

### Token budget (objective 4)

- **One call, no loop.** The only place this feature spends tokens.
- Output carries `revisedContent` **only** for applied fixes (usually small diffs), so output stays proportional to what actually changed; notes are one-liners.
- `usage` (input/output tokens) is returned and shown, so BYOK cost is visible per run.
- `shortcut:` the pass sends the full text of every filled section; for a very long PRD this input grows. Ceiling: no windowing/truncation. Upgrade path: chunk by section group if input ever becomes the bottleneck.

## Trade-offs

- **Single reviewer = single perspective.** A weak model misses some drift. Accepted for A; approach B (parallel lenses) is the upgrade, addable without changing the contract.
- **The AI triages, so it can under-escalate.** A real `high` finding marked `medium` lands as a collapsed note rather than a decision. Mitigated by: every finding is returned and counted, notes are one click away, and a note can be promoted to a decision by hand. `shortcut:`, upgrade path: route `medium` to escalation if it proves too quiet.
- **Auto-fix touches the document, and Tier 2 deletes.** Bounded by "provable against the canon", the deterministic verifier, the authorising `rule`, the returned `removed` text, and undo. The user consented by pressing the button.
- **Undo is session-only.** `before`/`removed` live in the result state, not the DB. A refresh after a review loses the one-click undo (the content stays fixed). `shortcut:`, upgrade path: persist the pre-review snapshot if refresh-safe undo is ever wanted.
- **Escalations are applied via a full re-draft** (existing *Buat ulang*) — correct but not the cheapest way to act on one finding. Upgrade path: apply a single decision through `buildRefinePrompt`.

## Data Model & API

- **No schema change.** Fixes → `sections` (via `saveSection`). Escalations → `plan_json` (via `savePlan` + `mergeDecisions`), never removing an existing decision. Notes are returned only, not stored.
- `POST /api/prd/review` — body `{ projectId: number }`; guards mirror `/api/prd/decisions`; JSON response `{ applied, escalated, notes, decisions, usage }` (`applied[]` carries `key`, `issue`, `rule`, `before`, `removed`, `after`). `401/400/404/409` reused (409 when the PRD has no content).

## Tests (`tests/review.test.mjs`)

- `parseReview`: valid JSON; fenced JSON; malformed text → `{ findings: [] }`; non-array fields ignored; unknown `weight` coerced to `low`.
- `route` (pure, exported): a finding with `rule` + passing verifier → applied; no `rule` → routed by weight; `weight: high` without options → note; `medium`/`low` → note.
- verifier: accepts an in-canon rename that keeps every ID and the heading; rejects a rewrite that drops an ID; **accepts** a Tier 2 removal that declares `removed` + a `rule` and drops an ID; rejects a dropped ID when `removed` or `rule` is missing, or when the `removed` text is still present; rejects a changed heading; rejects empty / unchanged content; never throws.
- escalation → decision mapping: fresh ids, `recommended === options[0]`, `mergeDecisions` appends without dropping existing decisions.

## Build Order (each step a vertical slice, verified)

1. `lib/review.ts` — `parseReview` + verifier + weight router + escalation→decision mapping; `tests/review.test.mjs`. Pure, no AI.
2. `buildReviewPrompt` in `lib/prompts.ts` + prompt assertions in `tests/prompts.test.mjs`.
3. `POST /api/prd/review` — guards, one call, parse → verify/route → `saveSection`/`savePlan`, JSON out.
4. `editor.tsx` — button, confirm, spinner, result card (counts + notes toggle + undo); escalations flow into `DecisionPanel`.
5. Copy + docs (`docs/architecture.md` flow + module map, `docs/development.md` test table, `AGENTS.md` verify list, `README.md`).
6. Full verify: `tsc`, `eslint`, all suites, manual run against a real endpoint.

## Left to the Builder

- Exact Indonesian labels (button, confirm, summary, undo, notes toggle) and whether the confirm is a dialog or a helper line.
- Whether `usage` is shown inline or behind a tooltip.
- How a note is promoted to a decision by hand (a small button on the note, or a manual `saveDecisionsAction` call).
- Escalation rendering in `DecisionPanel`: plain `label`, or prefix the label with the section title.
- Whether an escalation the user answers should offer a targeted single-section apply now, or stay on *Buat ulang*.
