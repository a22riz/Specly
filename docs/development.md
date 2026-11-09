# Development

How to run Specly locally and extend it. For how it works, see
[Architecture](architecture.md); for shipping it, see [Deployment](deployment.md).

## Setup

```sh
npm install
npm run dev        # http://localhost:3000
```

Requires Node 22+. No database to install — SQLite lives in `data/`.

Scripts (`package.json`):

| Script | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack), hot reload. |
| `npm run build` | Production build (`output: "standalone"`). |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |

## Environment

| Var | Default | Purpose |
|---|---|---|
| `PRD_DB_PATH` | `data/prd.sqlite` | SQLite file location. |
| `SPECLY_SECRET` | auto `data/secret.key` | HMAC session signing + AES key encryption. Set it in production so the secret is not on the data disk. |
| `PORT` | `3000` | Server port (`PORT=3001 npm run dev`). |

`.env.example` carries the production default; copy it to `.env` and fill `SPECLY_SECRET`
(`openssl rand -hex 32`). Local dev needs none of these.

## Tests

Twelve suite files under `tests/`, each a plain Node script with `node:assert` (no framework):

```sh
node --experimental-strip-types tests/<name>.test.mjs
```

| Suite | Covers |
|---|---|
| `auth` | password hashing, session tokens, key encryption |
| `db-messages` | per-project conversation accessors |
| `db-plan` | plan get/save |
| `db-discovery` | discovery flag + migration backfill |
| `prd` | `extractContent`, `conversationText`, `sectionsToWrite`, `hasAnyContent` |
| `plan` | `parsePlan`, `mergeDecisions` |
| `prompts` | prompt builders |
| `render` | `renderBundle`, `renderAgentOnboarding`, `renderPack` |
| `sse` | SSE record parser |
| `discovery` | discovery turn parsing |
| `concurrency` | `mapLimit` |
| `estimate` | `estimateRemainingMs` |

Before finishing any change, run typecheck, lint the changed files, and the suites:

```sh
npx tsc --noEmit
npx eslint <changed files>            # quote paths containing [id]
node --experimental-strip-types tests/render.test.mjs
```

`lib/` modules import with explicit `.ts` extensions so these scripts can run them directly; keep that
convention when adding imports inside `lib/`.

## Database migrations

`lib/db.ts` creates missing tables with `CREATE TABLE IF NOT EXISTS`, then evolves an existing schema
with guarded `ALTER TABLE`s:

```ts
const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
if (!cols.some((c) => c.name === "discovery_done")) {
  db.exec("ALTER TABLE projects ADD COLUMN discovery_done INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE projects SET discovery_done = 1"); // backfill existing rows
}
```

Follow the same shape for a new column: add it to the `CREATE TABLE`, add a guarded `ALTER TABLE`, and
backfill existing rows so old data keeps working. New **sections** need no migration — `sections.key`
is a free-form string.

## Recipes

### Add a PRD section

1. Add an entry to `PRD_SECTIONS` in `lib/prompts.ts` (`key: "prd.<name>"`, Indonesian `title`,
   English `enTitle`, `hint`, `aiPrompt`).
2. Nothing else — the draft loop (`app/api/prd`) and the editor both read `PRD_SECTIONS`. No DB change.

### Change a prompt

All prompts live in `lib/prompts.ts`; edit the builder, then update `tests/prompts.test.mjs` if the
contract changed. System prompts are the source of truth — do not restate them elsewhere.

### Add an API route

Create `app/api/<name>/route.ts`. Gate it with `getSessionUser()` (return 401 when null), validate the
body against an explicit narrow type, look the project up with `getProject(id)` and confirm
`project.user_id === user.id` (404 otherwise), and read the user's AI config with `getAiConfig(user.id)`.
Stream with `streamText` when the response is long; otherwise return JSON.

### Add a test

Drop a `tests/<name>.test.mjs`, import the module under test with `assert`, and add the run line to the
[Verify](#tests) list in `AGENTS.md`. Keep it a plain script — no test runner.

## Conventions

- **Indonesian** in UI copy, chat, hints; **English** in document content (inside `<content>`). Quoted
  product strings stay verbatim.
- Multi-user: scope every query to the session user; check ownership, not just identity.
- No new dependency without strong justification — stdlib or an existing dep first.
- Keep `lib/` logic free of Next.js imports when a test needs to import it directly
  (`auth-crypto.ts` is the model).
