# Product Brief (PRD)

## Status

- Last reviewed: 2026-11-19
- Evidence basis: repo (`README.md`, `AGENTS.md`, `docs/`, `docs/superpowers/specs/`, implementation)
- Confidence: high
- Known gaps: current user count and deployment status; success metrics are not defined anywhere.

## Problem

Non-IT people with an app idea cannot write a specification a coding agent can execute reliably. Specly
interviews them briefly and produces a complete, internally consistent PRD in Markdown that any coding
agent (Claude Code, Cursor, Copilot, …) can consume.

## Audience

- Primary: non-technical product owners on an internal team, working in Indonesian.
- Secondary consumer: the AI coding agent that reads the exported `PRD.md` + `AGENTS.md` (English).
- Admin: the first registered user; approves later sign-ups in *Kelola User*.

## Primary Journey

1. Register / sign in (first user becomes admin; others wait for approval).
2. Configure AI in *Pengaturan AI* (BYOK: Base URL, API key, model; key encrypted at rest).
3. Create a project, describe the idea in one line.
4. Discovery: 4–8 questions, one per turn, each with a recommended option. It never writes document content.
5. Plan: one call fixes category, decisions, assumptions, and canonical terminology.
6. Draft: the 12 sections draft in parallel, streamed with progress.
7. Review and edit: change decisions in *Perlu keputusan*, edit or refine sections, run *Tinjau PRD*
   (the "Goldfish" review pass) to align terminology and surface escalations; every fix is undoable.
8. Export `PRD.md`, `AGENTS.md`, or a ZIP with `CARA_PAKAI.md`.

## Constraints

- PRD-only: one project = one PRD = one conversation.
- Conversation Indonesian; document content English.
- No invention: unknowns become `[ASSUMPTION: …]` (category default) or `[NEEDS CLARIFICATION: …]`.
- Local-first: SQLite, no external DB, BYOK, single-writer (one replica).
- Every query scoped to the owning user.

## Non-goals

- Other document types (the multi-pack "blueprint" direction was dropped on 2026-11-05).
- Generating code, choosing frameworks, or inventing product facts for the user.
- Hosted multi-tenant SaaS: it is an internal-team tool.

## Unknowns

- Measurable success criteria for Specly itself.
- Whether a public or external audience is planned (none in evidence; no marketing brief created).
