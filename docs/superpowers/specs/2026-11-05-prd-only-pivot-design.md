# Specly v2 — PRD-only Pivot — Design Doc

## Intent and the Why

Specly today produces 5 packs (PRD, Brand, Design, Technical, Delivery — ~24 sections) and
asks the user to fill sections one at a time. That is heavy for a non-IT user and the output is
more than they need.

The user wants Specly to stay a tool that helps them produce a **PRD for the app they are
building** — but with far less input. Instead of filling fields, the user **brainstorms with an
AI agent**; the agent applies the appropriate **skill** from a skill bank and writes the PRD.

Output = **one PRD document**, following best practice and usable by a coding agent. Input
burden drops from ~24 fields to free conversation.

## Goals

- Input is free conversation (brainstorm), not a section-by-section form.
- Output is a single PRD document — best-practice and executable/understandable by a coding agent.
- The agent draws on a skill bank; phases run in a fixed order: gather → clarify → write.
- Reuse the existing infrastructure (auth, BYOK, SQLite, streaming, export, UI primitives).
- The PRD uses spec-driven-development conventions: prioritized, independently-testable user
  stories; Given/When/Then acceptance scenarios; numbered functional requirements; measurable
  success criteria; explicit assumptions and edge cases; `[NEEDS CLARIFICATION]` markers for
  unknowns.
- Keep the result not-too-complex.

## Non-Goals

- No Brand, Design, Technical, or Delivery documents.
- No logo generation.
- No per-section chat UI.
- No multi-agent orchestration.
- No full spec-kit `plan.md`, `tasks.md`, or `constitution`.
- No tool-calling skill router in v1.
- No schema migration — relaxed: one additive `messages` table was approved so the project
  conversation persists (the product owner chose to store it).

## Anti-Goals (failure even if it technically works)

- Output goes back to being multi-document.
- User has to fill many fields.
- A PRD a coding agent cannot act on (vague, contradictory, or invented details).
- Inventing unknown facts instead of marking them `[NEEDS CLARIFICATION]`.

## Constraints

- Stack unchanged: Next.js App Router, `better-sqlite3`, `@ai-sdk/openai`, `@base-ui/react`,
  Tailwind 4. No new runtime dependencies without strong justification.
- BYOK: every AI call uses the signed-in user's encrypted key, via Chat Completions at any
  OpenAI-compatible endpoint. Must not depend on tool-calling (small local models lack it).
- Multi-user: every project/config query is scoped to the session user.
- Conversation in Indonesian; document content in English inside `<content>` blocks.
- `sections` table unchanged (`project_id`, `key`, `content_md`) — keys stay free-form, no migration.
- `lib/prompts.ts` stays the single source of truth for section and prompt definitions.

## Approaches Considered

### Code base

- **A. Adapt `specly-v2` (CHOSEN).** Reuse auth, BYOK + key encryption, SQLite, streaming chat,
  export, `components/ui/*`, Docker + Cloudflare Tunnel. Change: drop 4 packs, rewrite
  `lib/prompts.ts` (PRD-only + skill prompts), rebuild `editor.tsx` as chat-first, render/export
  a single `PRD.md`. More deletion than addition; deploy keeps working.
- **B. Rewrite from scratch.** Cleaner, but re-solves auth/BYOK/deploy that already work. Slower,
  regression risk, no infra gain.
- **C. Keep 5 packs, add a "PRD-only mode".** Rejected — output stays multi-document (violates the
  goal) and adds complexity.

### How the agent selects a skill

- **A1. Fixed phases (CHOSEN).** One chat; the prompt changes by phase: gather → clarify → write.
  The "skill bank" is a set of phase prompts. Simple, reliable on every BYOK endpoint.
- **A2. Tool-calling router.** Skills become tools the model calls. Closest to "agent picks", but
  many OpenAI-compatible endpoints (Ollama, small models) do not support tool-calling → broken for
  some users.

**Decision: A + A1.** Biggest impact, least new code, works on all endpoints. A2 can be added later
without dismantling A1 (the phase prompts remain; a router would only choose among them).

## How It Gets Built

### 1. `lib/prompts.ts` — PRD-only + skills

- Collapse `PACKS` to a single `prd` pack holding these 12 sections:
  1. Ringkasan / Overview
  2. Tujuan & Non-Tujuan / Goals and Non-Goals
  3. User Story — prioritized P1/P2/P3, each independently testable (+ why this priority)
  4. Acceptance Scenarios — Given/When/Then per story
  5. Kebutuhan Fungsional / Functional Requirements — `FR-001: System MUST …`
  6. Entitas Kunci / Key Entities (only if the product has data)
  7. Edge Case
  8. Kebutuhan Non-Fungsional / Non-Functional Requirements
  9. Batasan & Asumsi / Constraints and Assumptions
  10. Glossary
  11. Kriteria Keberhasilan / Success Criteria — `SC-001`, measurable
  12. Definition of Done + Urutan Pengerjaan / Definition of Done and Build Order (light)
- Add phase prompts (the skill bank v1): **gather** (brainstorming method), **clarify**
  (grilling method), **write** (to-spec + writing-for-agents method).
- Keep the "never invent implementation details" rule; add the convention: when a fact is missing,
  emit `[NEEDS CLARIFICATION: …]` instead of guessing.
- Rework `buildSystemPrompt` modes to match the phases.

### 2. Editor — chat-first

- `editor.tsx` rewritten: one conversation instead of section tabs + per-section chat.
- Agent gathers and clarifies first (free chat), then writes the PRD when it judges there is
  enough, or when the user asks.
- The write phase fills the 12 section rows; the document is assembled from them.

### 3. Remove packs and routes

- Delete Brand/Design/Technical/Delivery pack definitions and prompts.
- Remove or reduce: `/api/generate-all`, `/api/validate`, `/api/plan`, `app/api/logo`,
  `components/logo-card.tsx`, `components/brand-steps.tsx`.
- `/api/chat` stays as the core transport.

### 4. Render and export

- `renderBundle` produces a single `PRD.md`.
- Export ZIP: `PRD.md` + `AGENTS.md` + `CARA_PAKAI.md`. Drop per-pack files and `LOGO.svg`.

### 5. Skill bank implementation

- v1 lives in code (`lib/prompts.ts`, or a small `lib/skills.ts`) as phase prompts. DB-backed,
  user-extensible skills are a later step, not v1.

## Decisions Settled During the Builder Check (my call)

- **Re-write behaviour:** the write phase is grounded in the existing PRD rows *and* the
  conversation. Re-running it replaces the 12 rows — no versioning, matching the app's existing
  "regenerate replaces" stance. The UI confirms before overwriting non-empty rows.
- **The produced PRD stays directly editable:** each of the 12 sections can be corrected by hand,
  so the user can fix AI output. Specly assumes AI is configured; there is no separate from-scratch
  manual-authoring mode (the app is chat-first).
- **`AGENTS.md` export:** rewritten to reference only `PRD.md` and to source the new keys
  (Batasan & Asumsi, Definition of Done). No stale references to the removed packs or old keys.

## Open Question

- **Is the brainstorm conversation persisted, or client-side and lost on reload?** Today's
  convention is "no stored conversations — only final section content persists", and a non-goal
  forbids a schema migration. Taken literally, the entire input method becomes ephemeral: a page
  refresh mid-brainstorm discards everything. Persisting it needs a `messages` table (a schema
  change the doc currently forbids). Awaiting the user's decision.

## What's Left to the Builder

- Exact wording of the 12 section prompts and 3 phase prompts — first pass functional; tune after
  real tests.
- Chat-first UX details, including **when writing triggers**: automatic when the agent judges the
  conversation sufficient, or an explicit user action ("Buat PRD"). Either is acceptable; must be
  predictable to the user and allow cancel.
- Whether the write phase streams section by section with progress (reuse the SSE path) or writes
  in one pass.
- Handling of existing installs that already hold the old pack sections (ignore, hide, or clean).
- The later path to a growing, DB-backed skill bank.
