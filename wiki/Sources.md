# Sources

This page catalogs source material, repository evidence, and unresolved unknowns for Specly.

## Source Material

- `README.md` — end-user overview (Indonesian): what Specly is, usage steps, the 12 PRD sections,
  deploy quick start, troubleshooting.
- `AGENTS.md` — rules for coding agents: language split, `lib/prompts.ts` as single source of truth,
  flow, no-invention rule, multi-user ownership, verify commands.
- `docs/index.md`, `docs/architecture.md`, `docs/development.md`, `docs/deployment.md` — canonical
  technical reference (stack, request flow, module map, data model, recipes, Docker/K8s).
- `docs/superpowers/specs/` + `docs/superpowers/plans/` — 8 design/plan pairs, 2026-10-28 → 2026-11-13:
  blueprint expansion, PRD-only pivot, discovery gate, one-shot PM rebuild, decisions review, PRD
  review pass, docs tidy, Elephant/Goldfish UI. All shipped.
- `design-system/specly/MASTER.md` — generated design tokens (2026-10-15); partly contradicted by the
  implementation (see Unknowns).
- `graphify-out/GRAPH_REPORT.md` — generated code knowledge graph.

## Repository Evidence

- Stack (`package.json`): Next.js 16.4.1, React 19.3.0, Tailwind 4, `@base-ui/react`, `ai` +
  `@ai-sdk/openai`, `better-sqlite3`, `fflate`, `sonner`, `lucide-react`, `next-themes`.
- Prompts and PRD sections: `lib/prompts.ts`. Domain logic: `lib/plan.ts`, `lib/discovery.ts`,
  `lib/review.ts`, `lib/prd.ts`, `lib/render.ts`. Data: `lib/db.ts` (SQLite, in-place migrations).
- Routes: `app/api/{discovery,prd,prd/refine,prd/decisions,prd/review,export,health}`.
- Tests: `tests/*.test.mjs` run with `node --experimental-strip-types` (list in root `AGENTS.md`).
- Deploy: `Dockerfile`, `compose.yaml`, `deploy/k8s/{specly,ingress}.yaml`.
- Recorded `shortcut:` debt: `lib/review.ts:127` (verifier trusts rule citation),
  `app/api/prd/review/route.ts:12` (non-streamed review), `components/decision-panel.tsx:48` (review
  landing mid-edit drops unsaved panel edits).
- `.opencode/skills/` (tracked, ~740 files) — OpenCode agent skills vendored into the repo.
- Git: 117 commits on `main`, first 2026-10-15, last 2026-11-13 (`8eb0b55`).

## Generated Source Briefs

- [sources/prd.md](sources/prd.md) — product intent and user journey. Confidence: high.
- [sources/design-brief.md](sources/design-brief.md) — UI direction and visual system. Confidence: medium.

## Unknowns

- Which design source is authoritative: `MASTER.md` (fuchsia/orange, Rubik/Nunito) or the shipped
  `app/globals.css` (slate/blue, Plus Jakarta Sans)? The design brief assumes the implementation.
- Next feature track after the review pass: not stated anywhere in the repo.
- Production status: deploy docs exist, but whether/where Specly is currently deployed and how many
  users it serves is unknown.
- Whether `.opencode/skills/` is meant to be versioned project tooling or an accidental commit.
