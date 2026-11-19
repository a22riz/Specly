# Specly Wiki

This is the maintained project knowledge layer for Specly.

## Overview

Specly is a Next.js 16 web app that helps non-IT users turn a one-line idea into a complete 12-section
PRD, then export Markdown (`PRD.md`, `AGENTS.md`, `CARA_PAKAI.md`) for an AI coding agent. Flow:
discovery gate → one-shot plan → parallel draft → decisions review → refine → review pass → export.
Local SQLite, BYOK (any OpenAI-compatible endpoint), multi-user for an internal team, deployed with
Docker Compose or single-replica Kubernetes. UI and chat are Indonesian; document content is English.

## Current Focus

Post-MVP and in active use. The last shipped tracks were the PRD review pass, Elephant/Goldfish UI
naming, and loading animations for every AI wait (2026-11-13). No feature plan is active; the next
feature is undecided — see [roadmap.md](roadmap.md).

## Core Pages

- [AGENTS.md](AGENTS.md) — wiki maintenance contract and automation policy
- [log.md](log.md) — project-context changelog
- [Sources.md](Sources.md) — source and evidence index
- [plans/README.md](plans/README.md) — planning contract and current plan state
- [roadmap.md](roadmap.md) — direction, next decision, deferred work

## Source Briefs

- [sources/prd.md](sources/prd.md) — product intent, audience, journey, constraints, non-goals
- [sources/design-brief.md](sources/design-brief.md) — UI principles and the real visual system
  (records a contradiction with `design-system/specly/MASTER.md`)

No separate technical brief: [`docs/architecture.md`](../docs/architecture.md) already covers stack,
module map, data model, and conventions, and stays canonical.

## Reference Docs (outside the wiki)

- [`docs/architecture.md`](../docs/architecture.md), [`docs/development.md`](../docs/development.md),
  [`docs/deployment.md`](../docs/deployment.md)
- [`docs/superpowers/README.md`](../docs/superpowers/README.md) — archive of past specs and plans
- [`graphify-out/GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md) — code knowledge graph
