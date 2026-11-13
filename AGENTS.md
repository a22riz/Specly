# Specly — guide for AI coding agents

Specly: Next.js web app (App Router) for non-IT users to turn a one-line idea into a complete **PRD**,
then export Markdown for coding agents. PRD-only and chat-first: a short **guided discovery** asks a
few questions (each with a recommended option), then a one-shot **plan** call, then the 12 PRD
sections draft in parallel, then the user reviews and edits the **decisions** and refines individual
sections. Local-only tool; data in SQLite; BYOK.

## Documentation map

The full docs live in `docs/` — read the relevant one before working in that area instead of
re-deriving it from the code:

- `docs/architecture.md` — stack, request flow, **complete module map**, data model, conventions.
- `docs/development.md` — setup, scripts, env, tests, migrations, recipes (add PRD section / prompt / route).
- `docs/deployment.md` — Docker + Cloudflare Tunnel, env, backup, updates.
- `docs/index.md` — table of contents.
- `design-system/specly/MASTER.md` — UI tokens and direction.

## Rules

- **Language:** conversation with users is **Indonesian** (UI copy, chat, hints); **document content
  inside `<content>` blocks is always English** — coding agents parse it best. Quoted product UI
  strings stay verbatim.
- **`lib/prompts.ts` is the single source of truth** for the pack, the 12 `PRD_SECTIONS`, the
  `APP_PLAYBOOK`, and every prompt builder. Adding a PRD section = one entry in `PRD_SECTIONS`; no DB
  migration. Do not restate prompts elsewhere.
- **Flow:** discovery gate → plan → parallel draft → decisions review → refine → export. Discovery only
  helps the user describe the idea; it never writes document content. It is floored at `DISCOVERY_MIN`
  (4) questions: the route bounces an early `done` back for one more question (`lib/discovery.ts`).
  The plan fixes a canonical `terminology` (entities/roles/glossary) that every section and refine
  prompt must reuse verbatim, so the 12 sections cannot drift into synonyms or contradict each other.
- **No invention:** prompts forbid inventing implementation details (frameworks, APIs) or
  product-specific facts (names, prices, numbers); unknowns use the `APP_PLAYBOOK` default marked
  `[ASSUMPTION: …]`, keeping `[NEEDS CLARIFICATION: …]` for what only the user can decide.
- **Multi-user (internal team, BYOK):** `projects.user_id` and `ai_config.user_id` scope every query —
  never fetch by id alone, always check ownership. Pages guard with `requireUser()` (redirects to
  `/masuk`); API routes return 401 via `getSessionUser()`. API keys are encrypted at rest and returned
  only to the owner's session.
- **Persistence:** one conversation per project (`messages` table, discovery turns included); the only
  other stored content is the final section rows and the per-project `discovery_done` flag.
- **UI:** follows `design-system/specly/MASTER.md`; primitives from `@base-ui/react` +
  `components/ui/`, Tailwind 4, lucide icons, sonner toasts.
- **Dependencies:** adding one requires strong justification; stdlib/existing deps first.

## Verify

```sh
npx tsc --noEmit
npx eslint <changed files>
node --experimental-strip-types tests/auth.test.mjs
node --experimental-strip-types tests/db-messages.test.mjs
node --experimental-strip-types tests/prd.test.mjs
node --experimental-strip-types tests/prompts.test.mjs
node --experimental-strip-types tests/render.test.mjs
node --experimental-strip-types tests/sse.test.mjs
node --experimental-strip-types tests/plan.test.mjs
node --experimental-strip-types tests/db-plan.test.mjs
node --experimental-strip-types tests/db-ownership.test.mjs
node --experimental-strip-types tests/concurrency.test.mjs
node --experimental-strip-types tests/discovery.test.mjs
node --experimental-strip-types tests/db-discovery.test.mjs
node --experimental-strip-types tests/estimate.test.mjs
```

## Code graph (graphify)

`graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` are a knowledge graph of this repo (god
nodes, communities, cross-file edges; extracted from `app/`, `lib/`, `components/`, `tests/`, `docs/` —
`.opencode/` excluded). Read `GRAPH_REPORT.md` first to orient, then query before grepping:
`graphify query "<question>"` or `graphify explain "<Symbol>"`. Rebuild after structural changes:
`graphify update .` (code-only, no LLM).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
