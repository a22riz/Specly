# Decisions review — design

**Status:** Proposed (awaiting approval)
**Date:** 2026-11-06
**Related:** `docs/superpowers/specs/2026-11-05-specly-discovery-gate-design.md`

## Intent

The read-only **"Keputusan yang dipakai"** panel (`components/decision-panel.tsx`) shows the AI's decisions but offers no way to act on them except **Buat ulang** and going back to the chat. After discovery is a gate, the panel is where the user should be able to review decisions at a high level — the same way each PRD section is reviewed — and change them before the PRD is (re)built.

## Goals

- The panel gains a **Review** toggle, mirroring the per-section Review/Tutup pattern.
- In review, each decision shows its `options` as a choice (the **Rekomendasi** marked) plus a free-text value for anything outside the options; the current `chosen` is preselected/prefilled.
- A **"Minta ubah lewat AI..."** box rewrites the decisions from one instruction.
- Both paths persist to `projects.plan_json`; **Buat ulang** re-drafts from the updated plan.

## Non-goals

- Editing the plan's `category` / `industry` / `scale` / `platform` / `assumptions` / `outline` — decisions only.
- Any change to the discovery flow.
- Per-decision AI instructions — v1 has one instruction box for the whole decisions set.

## Anti-goals

- Re-introducing the deleted `setDecision` validation that rejected a free-text `chosen` (a free-text value must survive the round-trip — `normalizeDecision` already keeps it).
- A second source of truth for decisions (they live only in `plan_json`).

## Constraints

- No new runtime dependency. `lib/prompts.ts` stays the single source of truth for prompts.
- `plan_json` is the store: reuse `getPlan` / `savePlan`. **No new DB column or accessor.**
- Every route/action checks `project.user_id === user.id`.
- UI/chat copy Indonesian; document content English.
- Design tokens: follow the live `app/globals.css` theme (semantic classes), not the drifted `MASTER.md`.

## Approaches

- **A (chosen).** Persist edits to the plan, mirroring the section pattern: Review → change → **Simpan**, plus a **Minta ubah lewat AI** endpoint. Edits survive reload.
- **B (rejected).** Ephemeral edits applied only on **Buat ulang**: less UI, but edits vanish on reload and Buat ulang has to carry them.

## The How (as decided)

- **`components/decision-panel.tsx`** — add a Review/Tutup toggle. When open, per decision: a radio from `options` (recommended labelled **Rekomendasi**) + an "other" free-text input; a **Simpan keputusan** button (`saveDecisionsAction`); a **"Minta ubah lewat AI..."** input + **Minta ubah** button (`POST /api/prd/decisions`). **Buat ulang** stays; while there are unsaved changes it is disabled with the hint *"Ada perubahan belum disimpan."* After a save, show *"Tekan Buat ulang untuk menerapkan ke PRD."*
- **`app/actions.ts`** — `saveDecisionsAction(projectId: number, decisions: Decision[]): Promise<void>`: `"use server"`; `requireUser()`; ownership check; `savePlan(projectId, { ...plan, decisions })`.
- **`app/api/prd/decisions/route.ts`** — `POST { projectId, instruction }`: same auth/config/ownership gates as `/api/prd/refine`; load the plan, `buildDecisionsRefinePrompt(planText(plan), instruction)`, one `provider.chat` call, parse the reply with `parsePlan` and take `.decisions` (merged onto the stored plan), `savePlan`, return the new decisions as JSON. Errors → JSON, keep the stored plan untouched.
- **`lib/prompts.ts`** — `buildDecisionsRefinePrompt(planText: string, instruction: string): string`: rewrite ONLY the `decisions` array, keep each `id` stable, first option stays the recommendation, the reply is one JSON object `{ "decisions": [ { id, label, question, recommended, options, chosen } ] }`.
- **`lib/plan.ts`** — unchanged (the free-text `chosen` is already preserved by `normalizeDecision`).

## What's left to the builder

- Exact radio/free-text composition, spacing, and focus behaviour.
- Whether **Minta ubah** streams (it does not need to — a plain JSON response is simplest).
- The precise wording of the AI prompt, kept consistent with the other builders.

## Testing

- `buildDecisionsRefinePrompt` → an assertion in `tests/prompts.test.mjs` (mentions `decisions`, the instruction, and a stable `id`).
- Route and server action: no unit harness → `npx tsc --noEmit` + `npx eslint`.
- Manual: open a project's decisions → switch a radio → Simpan → Buat ulang reflects it; type a free-text value not in the options and confirm it survives after reload; **Minta ubah lewat AI** rewrites and persists.
