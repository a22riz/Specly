# Blueprint Expansion — Design Doc

## Intent and the Why

Specly currently generates 3 packs (PRD, Brand, Design) via per-section AI chat. The user wants it to produce a *full* blueprint — 11 document types covering product, technical, and delivery planning — while keeping user effort minimal. The AI should do the heavy lifting: user inputs an idea, AI generates all documents, user reviews and edits.

The core shift: from "user fills sections one by one with AI assistance" to "user gives an idea, AI fills everything, user reviews."

## Goals

- Generate 11 document types from a single idea input, sequentially, with cross-section coherence
- AI validation: cross-document consistency check returning actionable findings
- Implementation plan: phased plan with task dependencies, generated from the document set
- Export handles all new doc types in ZIP + enhanced AGENTS.md
- Zero schema change — `sections` table stays as-is; new doc types are new keys in `PACKS`
- Minimize user effort — one "Generate" click produces the full blueprint

## Non-Goals

- Discovery interview / guided question flow (user effort too high)
- Versioning or change history (regenerate replaces; no rollback needed)
- Approval workflow / status tracking (review is inline in editor)
- Structured data model (markdown-first; validation uses AI, not SQL)
- Token/cost tracking
- Conversation persistence (generate-all is one-shot, not interactive)

## Anti-Goals (failure even if technically working)

- Sections that contradict each other (coherence is the product's core value)
- User must reconcile AI-generated contradictions manually
- Schema migration (breaks "no migration" principle and existing installs)
- Adding dependencies

## Constraints

- Next.js App Router, existing stack (`@ai-sdk/openai`, `better-sqlite3`, `@base-ui/react`, Tailwind 4)
- `lib/prompts.ts` is the single source of truth for pack/section definitions
- Multi-user BYOK — every AI call must resolve the user's encrypted API key
- `sections` table: `{project_id, key, content_md}` — no new columns, no new tables
- Conversation with user in Indonesian; document content in English inside `<content>` blocks
- Streaming via Chat Completions (`provider.chat`, not `provider.responses`)

## Approaches Considered

### A: Client-loop over existing `/api/chat`
Add a `"generate"` mode to the existing chat endpoint. Client loops through all sections, calls `/api/chat` per section, extracts `<content>`, saves via server action, feeds accumulated context to the next call.

- **Pros:** minimal new code, reuses everything
- **Cons:** 11 HTTP round-trips, each re-reads AI config + re-creates provider; no clean cancel; client manages state across 11 failure points; no resume if call 7 fails

### B: New `/api/generate-all` endpoint (CHOSEN)
Dedicated server endpoint. Reads AI config once, loops through sections server-side, streams SSE progress events. Saves each section to DB as it completes.

- **Pros:** single connection, single config read, server controls sequential flow, clean cancel via AbortController, progress events are structured
- **Cons:** ~80 lines of new server code (endpoint + loop + SSE)

### Dropped
Server action (no streaming) — 60s blind wait, no progress, no cancel, timeout risk.

**Decision: B.** Single connection, single config read, server-controlled flow, trivial cancel. 30 more lines than A for a fundamentally more reliable architecture.

## How It Gets Built

### 1. Expand `PACKS` in `lib/prompts.ts`

Add two new packs:

```typescript
export type PackId = "prd" | "brand" | "design" | "technical" | "delivery";
```

**`technical` pack** (`TECHNICAL.md`, "Technical Blueprint"):
- `technical.architecture` — Software Architecture Document
- `technical.data_model` — Data Model & API Specification
- `technical.nfr` — Non-Functional Requirements (technical depth, distinct from PRD's success criteria)
- `technical.test_strategy` — Test Strategy & Acceptance Criteria

**`delivery` pack** (`DELIVERY.md`, "Delivery Plan"):
- `delivery.plan` — Implementation Plan (phased, with task dependencies)
- `delivery.dod` — Definition of Done (enhanced, delivery-focused version of `prd.dod`)

Update `PACK_ORDER` to `["prd", "brand", "design", "technical", "delivery"]`.

Existing `prd.dod` stays in the PRD pack for backward compatibility (sections already stored under that key are still valid and render in PRD.md). `delivery.dod` is the enhanced version used in AGENTS.md export (replaces `prd.dod` reference there, with fallback). Both render in their respective pack files; AGENTS.md shows only `delivery.dod` (or `prd.dod` fallback) to avoid contradiction.

Each new section gets a `SectionDef` with `key`, `title` (Indonesian), `enTitle` (English), `hint` (Indonesian), `aiPrompt` (English instruction). Prompts must instruct the AI to stay grounded in prior sections and never invent implementation details.

### 2. `/api/generate-all` endpoint

**Route:** `app/api/generate-all/route.ts`

**Request:** `POST { projectId: string, idea: string }`

**Auth:** `getSessionUser()` → 401 if no session. Ownership check on project.

**Flow:**
1. Read user's AI config (`getAiConfig`) — decrypt API key
2. Read all existing sections for the project (for context + skip check)
3. Create OpenAI-compatible provider (`@ai-sdk/openai`)
4. For each section in `PACK_ORDER` → `PACKS[pack].sections`:
   a. **Skip if already filled** — if section has existing non-empty content, send `{"type":"section_skip","key":...}` and continue. Generate All only fills empty sections. User can regenerate individual sections via existing per-section chat.
   b. Build context via `buildContext(pack, sections, upstreamPacks)` — re-query after each save so context stays structured (mirrors `app/api/chat/route.ts` pattern)
   c. Build system prompt via `buildSystemPrompt(pack, section, "generate", projectTitle, contextMd)` — new `"generate"` mode
   d. Build user message: the idea + instruction to write the section now
   e. Stream `provider.chat.doStream()` — accumulate text
   f. Extract `<content>` block from accumulated response
   g. Save to DB: `saveSection(projectId, key, content)` — upsert
   h. Send SSE event: `{"type":"section_done","pack":"technical","key":"technical.architecture","title":"Arsitektur"}`
   i. Update in-memory sections map so next iteration's `buildContext` includes the just-written content
5. Send `{"type":"done"}` event with dynamic count: `{"totalSections": <computed from PACKS>, "generated": <number actually written>, "skipped": <number skipped>}`

**SSE protocol:**
```
event: section_start
data: {"pack":"prd","key":"prd.introduction","title":"Pendahuluan"}

event: chunk
data: {"text":"...streaming delta..."}

event: section_done
data: {"pack":"prd","key":"prd.introduction"}

event: section_skip
data: {"key":"prd.introduction","title":"Pendahuluan"}

event: done
data: {"totalSections":24,"generated":18,"skipped":6}

event: error
data: {"message":"...","section":"technical.architecture"}
```

**Error handling:** If a section fails, send `error` event with the section key. The endpoint continues to the next section (partial blueprint is better than none). Client shows which sections failed and offers "Generate" on those individually.

**New mode in `buildSystemPrompt`:** Add `"generate"` to the mode union. In generate mode, the instruction is: "Write the complete section now based on the idea and context. No questions. Output exactly one `<content>` block."

### 3. AI Validation endpoint

**Route:** `app/api/validate/route.ts`

**Request:** `POST { projectId: string }`

**Auth + ownership:** same pattern.

**Flow:**
1. Read all sections for the project
2. Assemble full context via `buildContext` across all packs
3. Single AI call with a validation-specific system prompt:
   - "Check these documents for: (1) requirements without test cases, (2) contradictions between sections, (3) missing information, (4) features mentioned but not specified. Return JSON array of findings."
4. Parse JSON response (defensive — wrap in try/catch, return empty array on parse failure)
5. Return `{ findings: Finding[] }`

**Finding shape:**
```typescript
type Finding = {
  severity: "error" | "warning" | "info";
  section: string; // section key, e.g. "technical.architecture"
  message: string; // English, what's wrong
  suggestion: string; // English, how to fix
};
```

Validation prompt lives in `lib/prompts.ts` as `buildValidationPrompt(contextMd: string): string`.

### 4. "Generate All" UI

In `editor.tsx`:

- New "Generate Blueprint" button in the header (next to "Unduh semua"). Visible when `aiReady` is true.
- Opens a dialog: textarea for the idea, "Generate" button.
- On generate: `fetch("/api/generate-all", { method: "POST", body: { projectId, idea } })`, consume SSE stream.
- Progress UI: list of all sections with status icons (pending → generating → done / failed). Updates as SSE events arrive.
- Cancel button (AbortController).
- When done: refresh sections state from server, show toast.

### 5. Validation UI

- New "Validasi" button in the header (next to Generate).
- On click: `fetch("/api/validate", { method: "POST", body: { projectId } })`.
- Results panel: list of findings grouped by severity. Each finding links to the section it references (clicking scrolls to / selects that section).
- "Perbaiki" action per finding: opens the section's chat with the finding as the first message.

### 6. Export extension

`lib/render.ts`:
- `renderBundle` already iterates `PACK_ORDER` — new packs flow through automatically.
- `renderAgentOnboarding`: add references to `TECHNICAL.md` and `DELIVERY.md` in the reading-order line. DoD section: use `delivery.dod` if present, fall back to `prd.dod` if absent (never show both — that's a contradiction the product exists to prevent).
- `CARA_PAKAI_MD`: add the two new files to the file list.

`app/api/export/route.ts`:
- ZIP already iterates `renderBundle` — new packs included automatically.
- Add `DELIVERY.md` and `TECHNICAL.md` to the AGENTS.md reference list.

### 7. Implementation Plan content

The `delivery.plan` section prompt instructs the AI to:
- Read all prior sections (PRD, Brand, Design, Technical)
- Produce a phased implementation plan: Phase 1, Phase 2, etc.
- Each phase: list of tasks, dependencies on prior phases, which FRs/US it delivers
- Format as markdown with `### Phase N: <name>` headings
- Include a dependency graph (text-based, not visual)

This is AI-generated markdown stored in `sections` under key `delivery.plan`. No structured data, no graph database. The export renders it as-is.

## What's Left to the Builder

- SSE stream consumption on the client (EventSource or manual ReadableStream parsing — builder's choice, but must support cancel)
- Progress UI component (which UI primitives to use — Card + Progress + Badge are already in the project)
- Error retry: failed sections can be regenerated individually via existing per-section chat. No special retry endpoint needed.
- Validation findings panel: placement (dialog vs inline panel) — builder's choice, but must not block editing
- Prompt tuning: the 8 new section prompts will need iteration. First pass should be functional; quality tuning happens after testing with real ideas.

## File Changes Summary

| File | Change |
|---|---|
| `lib/prompts.ts` | +2 packs, +8 section defs, +`"generate"` mode in `buildSystemPrompt`, +`buildValidationPrompt` |
| `lib/render.ts` | Update `renderAgentOnboarding` references, `CARA_PAKAI_MD` file list |
| `app/api/generate-all/route.ts` | NEW — SSE endpoint, sequential generation |
| `app/api/validate/route.ts` | NEW — validation endpoint |
| `app/projects/[id]/editor.tsx` | +Generate button/dialog, +Validate button/panel, +progress UI |
| `app/api/export/route.ts` | Minor — AGENTS.md reference list update |
| `app/api/chat/route.ts` | No change — per-section chat unchanged |

No changes to: `lib/db.ts`, `lib/auth.ts`, `lib/auth-crypto.ts`, `app/actions.ts`, `app/masuk`, `app/daftar`, `app/admin`, `components/logo-card.tsx`.
