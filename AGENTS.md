# Specly — guide for AI coding agents

Specly: Next.js web app (App Router) for non-IT users to compose a **PRD** with AI chat, then export Markdown for coding agents. PRD-only and chat-first — the user explores the product in conversation, then asks Specly to write the 12 PRD sections. Local-only tool; data in SQLite.

## Architecture

- **`lib/prompts.ts` is the single source of truth.** Pack definition (`PACKS` — a single `prd` pack), the 12 `PRD_SECTIONS`, and the two skill prompts: `buildExplorePrompt` (gather + clarify phase — talks Indonesian, asks plain-language questions, never writes document content) and `buildWriteSectionPrompt` (write phase — drafts ONE section as English markdown inside a single `<content>` block, grounds every claim in the conversation, marks unknowns `[NEEDS CLARIFICATION: …]`). `buildPrdContext` renders all 12 sections (filled and empty) to ground the agent. Adding a PRD section = adding an entry to `PRD_SECTIONS`. No DB migration needed — the `sections` table keys are free-form strings.
- **`lib/prd.ts`** — PRD flow helpers: `extractContent` (pulls the assistant's one `<content>` body, strips fences), `conversationText` (transcript for the write prompt), `sectionsToWrite` (empty-only by default, all 12 when forced), `hasAnyContent`. Covered by `tests/prd.test.mjs`.
- **Multi-user (internal team, BYOK).** `users` table (email + scrypt password hash); `projects.user_id` and `ai_config.user_id` scope every query — never fetch by id alone, always check ownership. Pages guard with `requireUser()` (redirects to `/masuk`); API routes return 401 via `getSessionUser()`.
- **`lib/auth-crypto.ts`** — pure node:crypto, no deps, covered by `tests/auth.test.mjs`: scrypt password hashes (`salt:hash`), HMAC-signed session tokens (`userId.expiry.sig`, 30 days), AES-256-GCM encryption for stored API keys (`iv:tag:cipher`). Server secret from env `SPECLY_SECRET`, else auto-generated `data/secret.key` (ponytail — set the env var when deploying).
- **`lib/auth.ts`** — session cookie `specly_session` (httpOnly, sameSite lax, secure in prod) + `startSession`/`endSession`/`getSessionUser`/`requireUser`.
- **`lib/db.ts`** — better-sqlite3, WAL mode, file at `data/prd.sqlite` (override: `PRD_DB_PATH`). Tables: `users`, `ai_config` (per user; API key stored encrypted), `projects` (per user), `sections` (`project_id`, `key`, `content_md`), and **`messages`** (`project_id`, `role`, `content`) — **one persisted conversation per project**, ordered by id; accessors `getMessages`/`addMessage`/`clearMessages` (covered by `tests/db-messages.test.mjs`).
- **`lib/render.ts`** — builds Markdown docs from section rows in `PACKS` order; empty sections render `_Belum diisi._`. `renderBundle` produces the single `PRD.md`; `renderAgentOnboarding` builds `AGENTS.md` for the target coding agent (product boundaries, non-goals, DoD, working practices); `CARA_PAKAI_MD` is the static Indonesian guide for the product owner. Tested by `tests/render.test.mjs`.
- **`lib/sse.ts`** — SSE record parser for the PRD stream (covered by `tests/sse.test.mjs`).
- **`app/api/chat`** — the **explore** phase. Streaming chat (Chat Completions via `@ai-sdk/openai` `provider.chat`, not `provider.responses`) to any OpenAI-compatible endpoint configured by the signed-in user, using `buildExplorePrompt`. Persists the user turn before streaming and the assistant reply in `onEnd` (drained independent of the client so the reply persists even if the client disconnects).
- **`app/api/prd`** — the **write** phase. Streams an SSE progress feed (`section_start`, `chunk`, `section_done`, `error`, `done`) while writing each PRD section in order from the stored conversation, saving every section as it finishes. Returns 409 when content already exists unless `force` is set.
- **`app/api/export`** — on-the-fly download, nothing cached to disk. Emits the single `PRD.md` (via `renderBundle`), `AGENTS.md` (`?file=onboarding`), or a ZIP containing `PRD.md`, `AGENTS.md` (`renderAgentOnboarding`), and `CARA_PAKAI.md` (human guide, Indonesian).
- **Deployment** — `output: "standalone"` in `next.config.ts`; `Dockerfile` (multi-stage, non-root, `node:22-bookworm-slim`), `compose.yaml` (app bound to `127.0.0.1:3000` only; TLS comes from a Cloudflare Tunnel in front, not from the app stack), named volume `specly-data` at `/app/data`. `PRD_DB_PATH=/app/data/prd.sqlite` and `SPECLY_SECRET` come from compose env — keep them in sync when touching deployment files.
- **`app/projects/[id]`** — chat-first editor: the conversation panel is primary; the 12 sections render below it for direct editing and per-section save.
- **`app/masuk` + `app/daftar` + `app/admin`** — login/register/user management. Registration is open but accounts start unverified: **login is blocked until an admin approves them in `/admin`** (no email is sent — verification is admin approval). The first-ever user is auto-promoted to verified admin (`createUser`), and a migration guard promotes the oldest user if an install has no admin. Admin dashboard (`/admin`, guard `requireAdmin`): verify, block/unblock, promote/demote, delete members. Blocked users lose their session immediately (`getSessionUser` drops them). Admins cannot be blocked or deleted by the member-scoped actions, and cannot demote/delete themselves.

## Conventions

- Conversation with users is **Indonesian** (UI copy, chat, hints); **document content inside `<content>` blocks is always English** — coding agents parse it best. Quoted product UI strings stay verbatim.
- The flow has two phases: **explore** (chat, Indonesian, questions only — no document output) then **write** (draft each PRD section in English from the stored conversation).
- System prompts instruct the AI to never invent implementation details (frameworks, APIs) or facts in PRD content; missing information becomes `[NEEDS CLARIFICATION: …]`.
- Section prompts must stay grounded: e.g. `prd.edgecases` only includes cases from or clearly implied by the conversation.
- UI follows `design-system/specly/MASTER.md`. Base UI primitives: `@base-ui/react` + shadcn-style `components/ui/`, Tailwind 4, lucide icons, sonner toasts.
- Conversations are persisted per project in the `messages` table; the only other stored content is the final section rows.
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
```

## Code graph (graphify)

`graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` are a knowledge graph of this repo (god nodes, communities, cross-file edges; extracted from `app/`, `lib/`, `components/`, `tests/`, `docs/` — `.opencode/` excluded). Read `GRAPH_REPORT.md` first to orient, then query before grepping: `graphify query "<question>"` or `graphify explain "<Symbol>"`. Rebuild after structural changes: `graphify update .` (code-only, no LLM).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
