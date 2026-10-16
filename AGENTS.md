# Specly — guide for AI coding agents

Specly: Next.js web app (App Router) for non-IT users to compose PRD + Design Pack + Brand Pack with AI chat, then export Markdown for coding agents. Local-only tool; data in SQLite.

## Architecture

- **`lib/prompts.ts` is the single source of truth.** Pack/section definitions (`PACKS`), all AI system prompts (section chat, logo generation `buildLogoPrompt`, logo revision `buildLogoRevisePrompt`). Adding a PRD/Design/Brand section = adding an entry to `PACKS[pack].sections`. No DB migration needed — the `sections` table keys are free-form strings.
- **Multi-user (internal team, BYOK).** `users` table (email + scrypt password hash); `projects.user_id` and `ai_config.user_id` scope every query — never fetch by id alone, always check ownership. Pages guard with `requireUser()` (redirects to `/masuk`); API routes return 401 via `getSessionUser()`.
- **`lib/auth-crypto.ts`** — pure node:crypto, no deps, covered by `tests/auth.test.mjs`: scrypt password hashes (`salt:hash`), HMAC-signed session tokens (`userId.expiry.sig`, 30 days), AES-256-GCM encryption for stored API keys (`iv:tag:cipher`). Server secret from env `SPECLY_SECRET`, else auto-generated `data/secret.key` (ponytail — set the env var when deploying).
- **`lib/auth.ts`** — session cookie `specly_session` (httpOnly, sameSite lax, secure in prod) + `startSession`/`endSession`/`getSessionUser`/`requireUser`.
- **`lib/db.ts`** — better-sqlite3, WAL mode, file at `data/prd.sqlite` (override: `PRD_DB_PATH`). Tables: `users`, `ai_config` (per user; API key stored encrypted), `projects` (per user), `sections` (`project_id`, `key`, `content_md`). Logo stored as section with key `brand.logo` (raw SVG, excluded from MD packs).
- **`lib/render.ts`** — builds Markdown docs from section rows in `PACKS` order; empty sections render `_Belum diisi._`. Also exports `CARA_PAKAI_MD` (static Indonesian guide for the product owner). Tested by `tests/render.test.mjs`.
- **`app/api/chat`** — streaming chat (Chat Completions via `@ai-sdk/openai` `provider.chat`, not `provider.responses`) to any OpenAI-compatible endpoint configured by the signed-in user.
- **`app/api/logo`** — accepts `{ projectId, svg?, feedback? }`; feedback+svg → revision prompt, else fresh generation. Streams to accumulate, extracts `<content>` block or raw `<svg>`, sanitizes with regex (strip `<script>`/`foreignObject`/`use`/`image`, `on*` handlers, `javascript:` hrefs) — see ponytail comment; real sanitizer needed before any public exposure. Logos render via `<img>` data URIs only, where SVG scripts never execute.
- **`app/api/export`** — on-the-fly MD/ZIP download, nothing cached to disk. ZIP includes per-pack MDs, `LOGO.svg` (if any), `AGENTS.md` (`renderAgentOnboarding`), and `CARA_PAKAI.md` (human guide, Indonesian).
- **Deployment** — `output: "standalone"` in `next.config.ts`; `Dockerfile` (multi-stage, non-root, `node:22-bookworm-slim`), `compose.yaml` (app + Caddy TLS sidecar, named volume `specly-data` at `/app/data`), `Caddyfile` (self-signed for bare IP, domain placeholder for real certs). `PRD_DB_PATH=/app/data/prd.sqlite` and `SPECLY_SECRET` come from compose env — keep them in sync when touching deployment files.
- **`components/logo-card.tsx`** — logo UI: preview, Regenerate, Revisi dengan AI (feedback textarea, shown only when a logo exists), manual SVG edit, download.
- **`app/masuk` + `app/daftar` + `app/admin`** — login/register/user management. Registration is open but accounts start unverified: **login is blocked until an admin approves them in `/admin`** (no email is sent — verification is admin approval). The first-ever user is auto-promoted to verified admin (`createUser`), and a migration guard promotes the oldest user if an install has no admin. Admin dashboard (`/admin`, guard `requireAdmin`): verify, block/unblock, promote/demote, delete members. Blocked users lose their session immediately (`getSessionUser` drops them). Admins cannot be blocked or deleted by the member-scoped actions, and cannot demote/delete themselves.

## Conventions

- Conversation with users is **Indonesian** (UI copy, chat, hints); **document content inside `<content>` blocks is always English** — coding agents parse it best. Quoted product UI strings stay verbatim.
- System prompts instruct the AI to never invent implementation details (frameworks, APIs) in PRD content.
- Section prompts must stay grounded: e.g. `prd.pitfalls` only includes items from conversation.
- UI follows `design-system/specly/MASTER.md`. Base UI primitives: `@base-ui/react` + shadcn-style `components/ui/`, Tailwind 4, lucide icons, sonner toasts.
- No stored conversations — only final section content persists.
- Adding a dependency requires strong justification; stdlib/existing deps first.

## Verify

```sh
npx tsc --noEmit
npx eslint <changed files>
node --experimental-strip-types tests/render.test.mjs
node --experimental-strip-types tests/auth.test.mjs
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
