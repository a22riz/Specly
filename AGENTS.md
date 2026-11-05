# Specly — guide for AI coding agents

Specly: Next.js web app (App Router) for non-IT users to turn a one-line idea into a complete **PRD**, then export Markdown for coding agents. PRD-only and chat-first: a short **guided discovery** asks a few questions (each with a recommended option), then a one-shot **plan** call, then the 12 PRD sections draft in parallel, then the user reviews a read-only **decisions summary** and refines individual sections. Local-only tool; data in SQLite.

## Architecture

- **`lib/prompts.ts` is the single source of truth.** Pack definition (`PACKS` — a single `prd` pack), the 12 `PRD_SECTIONS`, the `APP_PLAYBOOK` (category catalog: typical users, entities, features, edge cases, industry concerns), and the four prompt builders: `buildDiscoveryPrompt` (discovery phase — talks Indonesian, **recommendation-first**: classifies the idea against the playbook, leads with a recap + labeled assumptions + recommended decisions, asks exactly one question per turn as a JSON turn `{ say, question: { text, options }, done }` whose first option is the recommendation, capped at `DISCOVERY_MAX` (8) before it must return `done: true`, and never writes document content), `buildPlanPrompt` (one-shot plan call — returns a JSON plan: category, industry, scale, platform, 3–6 decisions, 3–6 assumptions, and a one-line brief per section), `buildSectionFromPlanPrompt` (drafts ONE section as English markdown inside a single `<content>` block, grounded in the plan + the user's raw description, fills gaps with the category default marked `[ASSUMPTION: …]`), and `buildRefinePrompt` (rewrites one section per a user instruction, keeping what is already correct). `buildPrdContext` renders all 12 sections (filled and empty) to ground the agent. Adding a PRD section = adding an entry to `PRD_SECTIONS`. No DB migration needed — the `sections` table keys are free-form strings.
- **`lib/prd.ts`** — PRD flow helpers: `extractContent` (pulls the assistant's one `<content>` body, strips fences), `conversationText` (transcript of the chat), `sectionsToWrite` (empty-only by default, all 12 when forced), `hasAnyContent`. Covered by `tests/prd.test.mjs`.
- **`lib/discovery.ts`** — the discovery turn contract: `DiscoveryTurn` (`say`, `question: { text, options } | null`, `done`), `DISCOVERY_MAX` (8), `canAskMore`, and `parseDiscoveryTurn` (tolerant: strips ```json fences, tries `JSON.parse`, then the first balanced `{ … }` span; a prose reply degrades to `{ say, question: null, done: false }`). Covered by `tests/discovery.test.mjs`.
- **`lib/estimate.ts`** — `estimateRemainingMs(done, total, elapsedMs)`: linear extrapolation for the draft progress line, `null` until the first section finishes. Covered by `tests/estimate.test.mjs`.
- **Multi-user (internal team, BYOK).** `users` table (email + scrypt password hash); `projects.user_id` and `ai_config.user_id` scope every query — never fetch by id alone, always check ownership. Pages guard with `requireUser()` (redirects to `/masuk`); API routes return 401 via `getSessionUser()`.
- **`lib/auth-crypto.ts`** — pure node:crypto, no deps, covered by `tests/auth.test.mjs`: scrypt password hashes (`salt:hash`), HMAC-signed session tokens (`userId.expiry.sig`, 30 days), AES-256-GCM encryption for stored API keys (`iv:tag:cipher`). Server secret from env `SPECLY_SECRET`, else auto-generated `data/secret.key` (ponytail — set the env var when deploying).
- **`lib/auth.ts`** — session cookie `specly_session` (httpOnly, sameSite lax, secure in prod) + `startSession`/`endSession`/`getSessionUser`/`requireUser`.
- **`lib/db.ts`** — better-sqlite3, WAL mode, file at `data/prd.sqlite` (override: `PRD_DB_PATH`). Tables: `users`, `ai_config` (per user; API key stored encrypted), `projects` (per user, plus a `discovery_done` flag), `sections` (`project_id`, `key`, `content_md`), and **`messages`** (`project_id`, `role`, `content`) — **one persisted conversation per project**, ordered by id; accessors `getMessages`/`addMessage`/`clearMessages` (covered by `tests/db-messages.test.mjs`). The discovery gate is per project: `isDiscoveryDone`/`markDiscoveryDone`, and a migration adds the column and backfills every existing project to done so legacy projects skip discovery (covered by `tests/db-discovery.test.mjs`).
- **`lib/render.ts`** — builds Markdown docs from section rows in `PACKS` order; empty sections render `_Belum diisi._`. `renderBundle` produces the single `PRD.md`; `renderAgentOnboarding` builds `AGENTS.md` for the target coding agent (product boundaries, non-goals, DoD, working practices); `CARA_PAKAI_MD` is the static Indonesian guide for the product owner. Tested by `tests/render.test.mjs`.
- **`lib/sse.ts`** — SSE record parser for the PRD stream (covered by `tests/sse.test.mjs`).
- **`app/api/discovery`** — the **discovery** phase. Streaming call (Chat Completions via `@ai-sdk/openai` `provider.chat`, not `provider.responses`) to any OpenAI-compatible endpoint configured by the signed-in user, using `buildDiscoveryPrompt` and the stored `askedCount`. Body is `{ projectId, message? }`: with a `message` it is the answer to the current question; without one it fetches question 1. Persists the user turn before streaming and the assistant reply in `onEnd` (drained independent of the client so the reply persists even if the client disconnects).
- **`app/api/prd`** — the one-shot draft. Streams an SSE progress feed (`plan`, `section_start`, `chunk`, `section_done`, `error`, `done`): first a `buildPlanPrompt` call (reusing a saved plan on re-run) parsed by `lib/plan.ts`, then the 12 sections draft in parallel via `mapLimit` (cap `DRAFT_LIMIT` in flight) from the plan + the stored chat transcript (via `conversationText`), saving each section as it finishes. Returns 409 when discovery is not done (`reason: "discovery"`) or when content already exists (`reason: "content"`) unless `force` is set.
- **`app/api/prd/refine`** — rewrites ONE saved section per a user instruction using `buildRefinePrompt`, saving the result.
- **`app/api/export`** — on-the-fly download, nothing cached to disk. Emits the single `PRD.md` (via `renderBundle`), `AGENTS.md` (`?file=onboarding`), or a ZIP containing `PRD.md`, `AGENTS.md` (`renderAgentOnboarding`), and `CARA_PAKAI.md` (human guide, Indonesian).
- **Deployment** — `output: "standalone"` in `next.config.ts`; `Dockerfile` (multi-stage, non-root, `node:22-bookworm-slim`), `compose.yaml` (app bound to `127.0.0.1:3000` only; TLS comes from a Cloudflare Tunnel in front, not from the app stack), named volume `specly-data` at `/app/data`. `PRD_DB_PATH=/app/data/prd.sqlite` and `SPECLY_SECRET` come from compose env — keep them in sync when touching deployment files.
- **`app/projects/[id]`** — document-first editor. On first open with no content, the **discovery card** runs (fetches question 1, streams one JSON turn per answer, hands off on `done: true`, the 8-question cap, or **Cukup, lanjut**), then the one-shot draft auto-runs once discovery is done. The 12 sections plus a read-only "Perlu keputusan" `DecisionPanel` (with **Buat ulang**) are primary; each section can be refined inline via `app/api/prd/refine`. A project whose `discovery_done` flag is set (or that already has content) skips the discovery card.
- **`app/masuk` + `app/daftar` + `app/admin`** — login/register/user management. Registration is open but accounts start unverified: **login is blocked until an admin approves them in `/admin`** (no email is sent — verification is admin approval). The first-ever user is auto-promoted to verified admin (`createUser`), and a migration guard promotes the oldest user if an install has no admin. Admin dashboard (`/admin`, guard `requireAdmin`): verify, block/unblock, promote/demote, delete members. Blocked users lose their session immediately (`getSessionUser` drops them). Admins cannot be blocked or deleted by the member-scoped actions, and cannot demote/delete themselves.

## Conventions

- Conversation with users is **Indonesian** (UI copy, chat, hints); **document content inside `<content>` blocks is always English** — coding agents parse it best. Quoted product UI strings stay verbatim.
- The flow is a **discovery gate → plan → parallel draft → decisions summary → refine**: `buildDiscoveryPrompt` asks a few Indonesian questions (one JSON turn each, recommended option first, capped at `DISCOVERY_MAX`); the **plan** call (`buildPlanPrompt` → JSON) then anchors **parallel** section drafting (`buildSectionFromPlanPrompt`, plan as the consistency anchor); the user reviews a read-only **decisions** summary and refines individual sections (`buildRefinePrompt`). Discovery only helps the user describe the idea; it never writes document content.
- System prompts instruct the AI to never invent implementation details (frameworks, APIs) or product-specific facts (real names, prices, numbers); when the conversation is silent, the AI fills the section with the category-standard default from `APP_PLAYBOOK` marked `[ASSUMPTION: …]`, keeping `[NEEDS CLARIFICATION: …]` for what only the user can decide.
- Section prompts must stay complete: e.g. `prd.edgecases` includes the cases the conversation mentioned plus the ones the category commonly needs, inferred ones marked `[ASSUMPTION: …]`.
- UI follows `design-system/specly/MASTER.md`. Base UI primitives: `@base-ui/react` + shadcn-style `components/ui/`, Tailwind 4, lucide icons, sonner toasts.
- Conversations are persisted per project in the `messages` table (discovery turns included); the only other stored content is the final section rows and the per-project `discovery_done` flag.
- Adding a dependency requires strong justification; stdlib/existing deps first.

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
node --experimental-strip-types tests/concurrency.test.mjs
node --experimental-strip-types tests/discovery.test.mjs
node --experimental-strip-types tests/db-discovery.test.mjs
node --experimental-strip-types tests/estimate.test.mjs
```

## Code graph (graphify)

`graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` are a knowledge graph of this repo (god nodes, communities, cross-file edges; extracted from `app/`, `lib/`, `components/`, `tests/`, `docs/` — `.opencode/` excluded). Read `GRAPH_REPORT.md` first to orient, then query before grepping: `graphify query "<question>"` or `graphify explain "<Symbol>"`. Rebuild after structural changes: `graphify update .` (code-only, no LLM).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
