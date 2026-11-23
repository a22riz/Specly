# Specly Wiki Agent Guide

<!-- PROJECT-WIKI-BOOTSTRAPPER:START v1 -->
This `wiki/` directory is the maintained knowledge and planning layer for Specly.

## Source Of Truth

- `index.md` is the wiki front door.
- `log.md` is the project-context changelog. Git owns routine implementation history.
- `Sources.md` catalogs source material, repository evidence, and unknowns.
- `plans/README.md` defines the planning contract and shows current plan state.
- `roadmap.md` tracks the next useful project direction.
- `sources/` holds source briefs (product intent, design) with status and confidence.

## Relationship To `docs/`

- `docs/architecture.md`, `docs/development.md`, `docs/deployment.md` remain the canonical technical
  reference. Link to them; do not copy them into the wiki. Keep them accurate when code changes.
- `docs/superpowers/` is the archive of completed design/plan pairs (2026-10-28 → 2026-11-13). Do not
  add new plans there; new plans go in `plans/`. Do not move or rename the archive without user approval.
- `lib/prompts.ts` is the single source of truth for prompts and the 12 PRD sections; never restate
  prompt text in the wiki.

## Rules

- Read `index.md` before structural wiki changes.
- Keep durable project knowledge, planning, decisions, and validation notes under `wiki/`.
- Update `index.md` when adding or materially changing durable pages.
- Update `log.md` after bootstrapping, planning, validation, or material project changes that affect
  durable project context.
- Wiki prose is English (matches `docs/`); quoted Indonesian UI strings stay verbatim.
- Use plain markdown and relative links.

## Automation Policy

- Commit docs-only wiki changes: auto
- Commit code changes: ask
- Push changes: ask
- Install dependencies: ask
- Run long commands: ask
- Create plans before code: meaningful-only

When auto-committing docs-only wiki changes: check `git status --short` first, stage only `wiki/`, root
agent guidance, and docs intentionally changed by wiki work, leave unrelated dirty files alone, and never
push.
<!-- PROJECT-WIKI-BOOTSTRAPPER:END -->
