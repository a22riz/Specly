# Specly Log

Append durable project-context changes here. Git owns routine implementation history. Use headings like
`## YYYY-MM-DD type | title`.

Log import events, planning direction changes, codebase sync summaries after unplanned work, validation
results that affect plans or roadmap, source-context changes, and important decisions discovered during
implementation. Do not log routine commits, every code edit, every test run, formatting, or minor
refactors. If this file becomes hard to scan, summarize older entries into `log-archive.md`.

## 2026-11-19 bootstrap | import existing repo into project wiki

- Mode: `import_existing`. Target root: repo root (single Next.js package, no workspace signals).
- Git result: preserved existing repository (117 commits, clean tree at import, HEAD `8eb0b55`).
- Lifecycle: internal tool in active use (multi-user internal team, Docker/K8s deploy docs) → post-MVP;
  no `plans/mvp/`.
- Decision (user): wiki coexists with `docs/`. `docs/` stays the canonical technical reference,
  `docs/superpowers/` is the archive of 8 completed spec/plan pairs, new plans go in `wiki/plans/`.
- Decision (user): automation policy auto-commits docs-only wiki changes; code commits, pushes,
  installs, and long commands still ask.
- Source briefs: generated `sources/prd.md` and `sources/design-brief.md`. Skipped technical brief and
  `Architecture.md` (covered by `docs/architecture.md`) and marketing brief (internal tool).
- Contradiction found: `design-system/specly/MASTER.md` (fuchsia/orange, Rubik + Nunito Sans,
  "Subscription Box Service" category) does not match the shipped UI (`app/globals.css`: slate/blue,
  Plus Jakarta Sans, dark mode). Recorded in the design brief; unresolved.
- Staleness found: `docs/superpowers/README.md` lists 7 features but omits the shipped
  Elephant/Goldfish UI pair (spec + plan dated 2026-11-13). Commit `8eb0b55` (loading animations)
  shipped without a spec/plan.
