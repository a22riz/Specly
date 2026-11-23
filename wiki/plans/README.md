# Plans

Status: no active plan · Shape: none · Current unit: none · Blockers: next feature undecided ·
Next action: pick a track from [../roadmap.md](../roadmap.md), then create `features/<name>.md`.

This directory holds durable implementation plans for Specly.

## Planning Rule

Create or update a markdown plan before meaningful code, config, schema, dependency, architecture,
test, build, or app behavior changes. Any change to `lib/prompts.ts`, the flow, the data model, or
ownership/auth checks counts as meaningful.

Fast-path exception: for small, local, reversible fixes that do not change product behavior,
architecture, schema, dependencies, build configuration, public APIs, security posture, or durable
project direction, do not create a plan. Make the change, validate it, and avoid wiki/log updates
unless the fix reveals durable project knowledge.

## Structure

- `features/` — focused feature plans (create when the first one is needed).
- `maintenance/` — refactors, upgrades, tech debt, infra (create when needed).
- `zzz_completed/` — completed plans after all units and verification records support completion.
- No `mvp/`: Specly is post-MVP and in active use.
- Every execution unit has a `## Verification` section. Default checks: `npx tsc --noEmit`,
  `npx eslint <changed files>`, the relevant `tests/*.test.mjs`, and for UI work a browser check
  against [../sources/design-brief.md](../sources/design-brief.md).
- A plan may keep the existing house style (Intent / Goals / Non-goals / Anti-goals / Constraints /
  Approaches / Decisions) used in `docs/superpowers/specs/`.

## Current Planning State

No active plan. Next planning target: choose from the roadmap's candidate tracks.

## Completed Plans

None archived in the wiki yet. Pre-wiki history (8 shipped design/plan pairs, 2026-10-28 → 2026-11-13)
lives in [`../../docs/superpowers/README.md`](../../docs/superpowers/README.md).

## Read Commands

```sh
sed -n '1,40p' wiki/plans/README.md
sed -n '1,60p' wiki/roadmap.md
ls docs/superpowers/specs docs/superpowers/plans
```
