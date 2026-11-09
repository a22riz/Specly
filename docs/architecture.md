# Architecture

Specly turns a one-line idea into a complete **PRD** for non-IT users, then exports Markdown for a
coding agent. Everything runs locally: Next.js serves the app and the AI routes, and SQLite holds all
state. There is no external database and no background worker.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.4.1 (App Router), React 19.3.0 |
| Styling | Tailwind CSS 4, `@base-ui/react` + shadcn-style `components/ui/`, lucide-react, sonner |
| Data | SQLite via `better-sqlite3` (synchronous, WAL) |
| AI | `@ai-sdk/openai` (`createOpenAI` + `provider.chat`) and the `ai` SDK (`streamText`) |
| Export | `fflate` (`zipSync`) for the ZIP bundle |
| Auth | `node:crypto` only — scrypt hashes, HMAC session tokens, AES-256-GCM for keys |

Any OpenAI-compatible endpoint works (OpenAI, Ollama, Groq, OpenRouter, vLLM…): the user supplies
Base URL + API key + model per account (**BYOK**).

## Request flow

```
Discovery gate → one-shot plan → 12 sections drafted in parallel → decisions review → refine → export
```

1. **Discovery** (`app/api/discovery`): a short Indonesian chat, one question per turn (each with a
   recommended option), capped at `DISCOVERY_MAX` (8). Persists every turn. It only helps the user
   describe the idea; it never writes document content.
2. **Plan** (`app/api/prd`, first step): a single call returns a JSON plan — category, industry,
   scale, platform, 3–6 decisions, 3–6 assumptions, and a one-line brief per section. Reused on
   re-runs.
3. **Draft** (`app/api/prd`, main step): the 12 sections draft in parallel (`mapLimit`, cap
   `DRAFT_LIMIT = 4`), each grounded in the plan + the chat transcript, streamed as SSE progress, and
   saved as each finishes.
4. **Decisions review** (`app/api/prd/decisions`): the user can send one instruction to rewrite the
   plan's decisions; the result is merged into the stored plan and persisted.
5. **Refine** (`app/api/prd/refine`): rewrite one saved section per a short instruction.
6. **Export** (`app/api/export`): on-the-fly download, nothing cached to disk.

## Module map

### `lib/` — logic, no HTTP

- **`lib/prompts.ts` is the single source of truth.** Exports `PACKS` (one `prd` pack), the 12
  `PRD_SECTIONS`, `APP_PLAYBOOK` (category catalog: typical users, entities, features, edge cases,
  industry concerns), and the prompt builders:
  - `buildDiscoveryPrompt` — recommendation-first JSON turn `{ say, question: { text, options }, done }`.
  - `buildPlanPrompt` — one-shot JSON plan.
  - `buildSectionFromPlanPrompt` — one section as English markdown inside a single `<content>` block.
  - `buildRefinePrompt` — rewrite one section per instruction.
  - `buildDecisionsRefinePrompt` — rewrite the plan's decisions per instruction.
  - `buildPrdContext` — renders all 12 sections (filled and empty) to ground the agent.

  Adding a PRD section = adding an entry to `PRD_SECTIONS`. No DB migration needed (section keys are
  free-form strings).
- **`lib/plan.ts`** — the `Plan`/`Decision`/`Assumption` types, `parsePlan` (tolerant: strips fences,
  tries `JSON.parse`, then the first balanced `{ … }` span, else `minimalPlan()`), `mergeDecisions`
  (keeps stored order, replaces by id, appends new), `planText` (renders a plan for prompts).
- **`lib/prd.ts`** — `extractContent` (pulls the one `<content>` body), `conversationText` (transcript),
  `sectionsToWrite` (empty-only unless forced), `hasAnyContent`.
- **`lib/discovery.ts`** — the discovery turn contract: `DiscoveryTurn`, `DISCOVERY_MAX` (8),
  `canAskMore`, `parseDiscoveryTurn` (tolerant; a prose reply degrades to `{ say, question: null, done: false }`).
- **`lib/estimate.ts`** — `estimateRemainingMs(done, total, elapsedMs)` for the draft progress line.
- **`lib/concurrency.ts`** — `mapLimit` for the bounded parallel draft.
- **`lib/sse.ts`** — SSE record parser for the PRD stream.
- **`lib/db.ts`** — all SQLite access + schema/migrations (see Data model).
- **`lib/auth-crypto.ts`** — pure `node:crypto`, no deps: scrypt password hashes (`salt:hash`),
  HMAC-signed session tokens (`userId.expiry.sig`, 30 days), AES-256-GCM key encryption
  (`iv:tag:cipher`). Server secret from env `SPECLY_SECRET`, else auto-generated `data/secret.key`.
- **`lib/auth.ts`** — session cookie `specly_session` (httpOnly, sameSite lax, secure in prod) +
  `startSession` / `endSession` / `getSessionUser` / `requireUser` / `requireAdmin`.
- **`lib/render.ts`** — builds Markdown from section rows in `PACKS` order (empty → `_Belum diisi._`).
  `renderBundle` → the single `PRD.md`; `renderAgentOnboarding` → `AGENTS.md` for the target agent;
  `CARA_PAKAI_MD` → the static Indonesian guide for the product owner.

### `app/api/` — HTTP routes

All routes return 401 via `getSessionUser()` and scope every query to the signed-in user.

- `discovery` — streaming discovery turn. Body `{ projectId, message? }`; no message fetches question 1.
- `prd` — the one-shot draft. SSE feed (`plan`, `section_start`, `chunk`, `section_done`, `error`,
  `done`). Returns 409 `reason: "discovery" | "content"` unless `force`.
- `prd/refine` — rewrite one section.
- `prd/decisions` — rewrite the plan's decisions, merge, persist.
- `export` — download. `?file=prd` → `PRD.md`, `?file=onboarding` → `AGENTS.md`, otherwise a ZIP with
  `PRD.md` + `AGENTS.md` + `CARA_PAKAI.md`.

### `app/` — pages and actions

- `app/page.tsx` — project list (per user).
- `app/projects/[id]/page.tsx` + `editor.tsx` — the document-first editor. Runs the discovery card
  when the project has no content and the gate is not done, then auto-runs the draft. The 12 sections
  and the editable `DecisionPanel` are primary.
- `app/masuk`, `app/daftar` — login / register. `app/admin` — user management (`requireAdmin`).
- `app/actions.ts` — server actions (auth, AI config, projects, sections, decisions, discovery finish).

### `components/`

`app-header.tsx`, `project-list.tsx`, `decision-panel.tsx`, `settings-dialog.tsx`,
`user-management.tsx`, `auth-form.tsx`, `ai-typing.tsx`, and `components/ui/` primitives.

## Data model

SQLite at `data/prd.sqlite` (override `PRD_DB_PATH`); WAL mode, foreign keys on. Schema lives in
`lib/db.ts` and evolves in place:

| Table | Columns | Notes |
|---|---|---|
| `users` | `id, email, password_hash, role, email_verified, blocked, created_at` | First-ever user bootstraps as verified admin. |
| `ai_config` | `user_id, base_url, api_key, model` | One row per user; `api_key` stored AES-256-GCM encrypted. |
| `projects` | `id, user_id, title, plan_json, discovery_done, created_at, updated_at` | `plan_json` = the serialized `Plan`; `discovery_done` gates the draft. |
| `sections` | `project_id, key, content_md, updated_at` | `key` is a free-form string (`prd.*`); upserted by `(project_id, key)`. |
| `messages` | `id, project_id, role, content, created_at` | One persisted conversation per project, ordered by id. |

Migrations are guarded by `PRAGMA table_info(...)` checks followed by `ALTER TABLE`, so fresh installs
and existing ones converge. The `discovery_done` migration backfills every existing project to done so
legacy projects skip discovery; a bootstrap guard promotes the oldest user if an install has no admin.

## Conventions

- **Language:** conversation with users is **Indonesian** (UI copy, chat, hints); document content
  inside `<content>` blocks is **always English**. Quoted product UI strings stay verbatim.
- **No invention:** prompts forbid inventing implementation details or product facts; unknowns are
  filled with the category default marked `[ASSUMPTION: …]`, keeping `[NEEDS CLARIFICATION: …]` for
  what only the user can decide.
- **Multi-user, BYOK:** every project/config query is scoped to the session user; never fetch by id
  alone — always check ownership. Pages guard with `requireUser()`, API routes with `getSessionUser()`.
- **UI:** follows `design-system/specly/MASTER.md`; primitives from `@base-ui/react` + `components/ui/`.
- **Dependencies:** adding one needs strong justification; stdlib or an existing dep first.
