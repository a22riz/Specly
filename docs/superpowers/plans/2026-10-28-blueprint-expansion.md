# Blueprint Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Specly from a 3-pack PRD generator to a 5-pack full blueprint platform with AI-generated documents, cross-document validation, and phased implementation plans — all from a single idea input.

**Architecture:** Add `technical` and `delivery` packs to `PACKS`. New `/api/generate-all` SSE endpoint generates all empty sections sequentially with cross-section context. New `/api/validate` endpoint runs AI consistency check. Export and AGENTS.md render new packs automatically. Zero schema change — new doc types are new section keys.

**Tech Stack:** Next.js App Router, `@ai-sdk/openai` (Chat Completations via `provider.chat`), `better-sqlite3`, `@base-ui/react`, Tailwind 4, lucide icons.

**Spec:** `docs/superpowers/specs/2026-10-28-blueprint-expansion-design.md`

## Global Constraints

- `sections` table stays `{project_id, key, content_md}` — no new columns, no new tables, no migration
- `lib/prompts.ts` is the single source of truth for pack/section definitions
- Every AI call must resolve the user's encrypted API key (BYOK multi-user)
- Conversation with user in Indonesian; document content in English inside `<content>` blocks
- Streaming via Chat Completions (`provider.chat`, not `provider.responses`)
- UI copy in Indonesian; document titles/headings in English
- No new dependencies — use existing `@ai-sdk/openai`, `ai`, `fflate`, etc.
- Test pattern: `node --experimental-strip-types tests/<name>.test.mjs` with `node:assert`

## Review Focus

1. **Generate All skips filled sections** — sections with existing content are never overwritten. Test: Task 4 asserts skip behavior.
2. **Generate All sends structured SSE events** — client can parse `section_start`/`section_done`/`section_skip`/`done`/`error`. Test: Task 4 asserts event types and JSON shape.
3. **Validation returns parseable JSON findings** — malformed AI response doesn't crash the endpoint. Test: Task 5 asserts empty-array fallback on unparseable JSON.
4. **Export includes all 5 packs** — ZIP and individual file downloads include `TECHNICAL.md` and `DELIVERY.md`. Test: Task 3 asserts bundle file list.
5. **AGENTS.md never shows two DoD blocks** — `delivery.dod` when present, else `prd.dod` fallback, never both. Test: Task 3 asserts single DoD.

---

### Task 1: Expand PACKS with technical and delivery packs

**Files:**
- Modify: `lib/prompts.ts` (entire file)
- Test: `tests/prompts.test.mjs`

**Interfaces:**
- Produces: `PackId` now includes `"technical" | "delivery"`. `PACKS` has 5 entries. `PACK_ORDER` is `["prd", "brand", "design", "technical", "delivery"]`. `buildSystemPrompt` accepts `"generate"` mode. `buildValidationPrompt(contextMd: string): string` exported.

- [ ] **Step 1: Write the failing test**

`tests/prompts.test.mjs`:
```javascript
import assert from "node:assert";
import { PACKS, PACK_ORDER, buildSystemPrompt, buildValidationPrompt } from "../lib/prompts.ts";

assert.deepEqual(PACK_ORDER, ["prd", "brand", "design", "technical", "delivery"], "PACK_ORDER has 5 packs in authoring order");
assert.ok(PACKS.technical, "technical pack exists");
assert.ok(PACKS.delivery, "delivery pack exists");
assert.equal(PACKS.technical.file, "TECHNICAL.md");
assert.equal(PACKS.delivery.file, "DELIVERY.md");
assert.ok(PACKS.technical.sections.length >= 4, "technical has at least 4 sections");
assert.ok(PACKS.delivery.sections.length >= 2, "delivery has at least 2 sections");
assert.ok(PACKS.delivery.sections.some(s => s.key === "delivery.plan"), "delivery.plan section exists");
assert.ok(PACKS.delivery.sections.some(s => s.key === "delivery.dod"), "delivery.dod section exists");

const sys = buildSystemPrompt("prd", PACKS.prd.sections[0], "generate", "Test App", "");
assert.match(sys, /Write the complete section now/, "generate mode instructs immediate writing");
assert.match(sys, /no questions/i, "generate mode says no questions");

const valPrompt = buildValidationPrompt("## Introduction\nSome context here");
assert.match(valPrompt, /JSON/, "validation prompt asks for JSON");
assert.match(valPrompt, /contradiction/i, "validation prompt checks contradictions");

console.log("prompts.test OK");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `PACKS.technical` is undefined, `PACK_ORDER` has 3 entries.

- [ ] **Step 3: Add technical and delivery packs to `lib/prompts.ts`**

Update `PackId` type to `"prd" | "brand" | "design" | "technical" | "delivery"`.

Add to `PACKS` object, after `brand`:

```typescript
technical: {
  id: "technical",
  name: "Technical Blueprint",
  description: "Spesifikasi teknis: arsitektur, data model, API, dan strategi testing.",
  file: "TECHNICAL.md",
  docTitle: "Technical Blueprint",
  sections: [
    {
      key: "technical.architecture",
      title: "Arsitektur Software",
      enTitle: "Software Architecture",
      hint: "Komponen sistem, hubungan antar komponen, dan aliran data.",
      aiPrompt: "Write the Software Architecture section based on the PRD and Design Pack. Describe the system architecture: major components, their responsibilities, how they connect, and the data flow between them. Use ### Component Overview, ### Data Flow, ### Technology Choices with justification grounded in the PRD constraints. Never invent frameworks or APIs the PRD does not mention — if a choice is open, say so and recommend with reasoning.",
    },
    {
      key: "technical.data_model",
      title: "Model Data & API",
      enTitle: "Data Model and API Specification",
      hint: "Tabel data, field, relasi, dan endpoint API yang dibutuhkan.",
      aiPrompt: "Write the Data Model & API Specification based on the PRD functional requirements and architecture. List data entities with their fields (business-language names — the coding agent decides types), relationships between entities, and API endpoints (method, path, request/response summary). Use ### Data Entities (as a table), ### Relationships, ### API Endpoints (as a table). Ground every entity and endpoint in a functional requirement — if a requirement needs data not listed here, add it.",
    },
    {
      key: "technical.nfr",
      title: "Kebutuhan Non-Fungsional Teknis",
      enTitle: "Non-Functional Requirements",
      hint: "Performa, keamanan, skalabilitas, dan keterbatasan teknis.",
      aiPrompt: "Write technical Non-Functional Requirements as a numbered list with IDs (T-NFR-1, T-NFR-2...). Cover performance targets, security measures, scalability, observability, and data integrity. Measurable where possible (response time targets, rate limits, backup frequency). Do not repeat business-level NFRs from the PRD — focus on technical depth.",
    },
    {
      key: "technical.test_strategy",
      title: "Strategi Testing",
      enTitle: "Test Strategy and Acceptance Criteria",
      hint: "Jenis test, lingkup, dan kriteria terima per fitur.",
      aiPrompt: "Write the Test Strategy & Acceptance Criteria based on the PRD user stories and functional requirements. Cover: test layers (unit, integration, e2e), what each layer covers, acceptance criteria per user story (reference US IDs), edge cases to test, and manual verification steps. Use ### Test Layers, ### Acceptance Criteria (table with US ID, scenario, expected result), ### Edge Cases.",
    },
  ],
},
delivery: {
  id: "delivery",
  name: "Delivery Plan",
  description: "Rencana implementasi bertahap dan definisi selesai.",
  file: "DELIVERY.md",
  docTitle: "Delivery Plan",
  sections: [
    {
      key: "delivery.plan",
      title: "Rencana Implementasi",
      enTitle: "Implementation Plan",
      hint: "Fase implementasi, urutan tugas, dan dependensi antar fase.",
      aiPrompt: "Write the Implementation Plan based on ALL prior sections (PRD, Brand, Design, Technical). Break the work into phases (Phase 1, Phase 2, etc.), each phase delivering a vertical slice of user value. For each phase: list the tasks, which functional requirements (FR IDs) and user stories (US IDs) it delivers, and dependencies on prior phases. Order phases so each builds on the previous. Use ### Phase N: <name> headings with bullet lists of tasks, then a ### Dependencies subsection. Include a text-based dependency summary at the end.",
    },
    {
      key: "delivery.dod",
      title: "Definisi Selesai",
      enTitle: "Definition of Done",
      hint: "Checklist verifikasi sebelum fitur dianggap selesai.",
      aiPrompt: "Write a Definition of Done checklist for coding agents working on this project. Every item must be verifiable before a feature counts as finished. Cover: acceptance scenarios pass, edge cases handled, tests exist for core logic, lint and typecheck clean, accessibility basics checked, documentation updated. Adapt items to this specific product based on the PRD and technical sections — no generic filler. Use a bullet checklist.",
    },
  ],
},
```

Update `PACK_ORDER` to `["prd", "brand", "design", "technical", "delivery"]`.

Add `"generate"` to the `mode` parameter type in `buildSystemPrompt`. In the function, add the generate-mode interview instruction:
```typescript
const interview =
  mode === "suggest"
    ? `The user is exploring this section. Ask the user up to 2 short questions in Indonesian at a time...`
    : mode === "refine"
      ? `The user wrote a draft or notes. Rewrite it into the polished section content in English...`
      : `Write the complete section now based on the idea and context provided. Do not ask questions. Output exactly one <content> block with the final section content in English.`;
```

Add `buildValidationPrompt` function after `buildContext`:
```typescript
export function buildValidationPrompt(contextMd: string): string {
  return [
    `You are a blueprint consistency validator. Read the complete project documentation below and check for:`,
    `1. Requirements (FR IDs) without corresponding test cases or acceptance criteria.`,
    `2. Contradictions between sections (e.g., PRD says X, Technical says not-X).`,
    `3. Features mentioned in one document but not specified in the relevant section.`,
    `4. User stories (US IDs) without functional requirements covering them.`,
    `5. Missing information: sections that are too vague to implement.`,
    ``,
    `Return a JSON array of findings. Each finding:`,
    `{"severity":"error|warning|info","section":"<section key>","message":"<what is wrong>","suggestion":"<how to fix>"}`,
    ``,
    `If no issues found, return an empty array: []`,
    ``,
    `Documentation:`,
    contextMd,
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: PASS — "prompts.test OK"

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts tests/prompts.test.mjs
git commit -m "feat: add technical and delivery packs with generate mode and validation prompt"
```

---

### Task 2: Extend render.ts for new packs and AGENTS.md DoD fallback

**Files:**
- Modify: `lib/render.ts` (entire file)
- Test: `tests/render.test.mjs`

**Interfaces:**
- Consumes: `PACK_ORDER` includes `"technical"` and `"delivery"` from Task 1. `PACKS.delivery.sections` includes `delivery.dod`.
- Produces: `renderAgentOnboarding` uses `delivery.dod` when present, falls back to `prd.dod`, never both. `renderBundle` outputs 5 files. `CARA_PAKAI_MD` lists all 5 pack files.

- [ ] **Step 1: Write the failing test**

Add to `tests/render.test.mjs` (after existing assertions):
```javascript
const bundle5 = renderBundle(sections, "Todo App");
assert.deepEqual(
  bundle5.map((b) => b.file),
  ["PRD.md", "BRAND_PACK.md", "DESIGN_PACK.md", "TECHNICAL.md", "DELIVERY.md"],
  "bundle includes technical and delivery packs",
);

const dodSections = [
  { key: "prd.dod", content_md: "### PRD DoD\n- Basic checklist" },
  { key: "delivery.dod", content_md: "### Delivery DoD\n- Enhanced checklist" },
];
const onbWithBoth = renderAgentOnboarding(dodSections, "Todo App");
assert.match(onbWithBoth, /Enhanced checklist/, "uses delivery.dod when present");
assert.equal(onbWithBoth.includes("Basic checklist"), false, "does not show prd.dod when delivery.dod exists");

const onbWithPrdOnly = renderAgentOnboarding([{ key: "prd.dod", content_md: "### PRD DoD\n- Basic only" }], "Todo App");
assert.match(onbWithPrdOnly, /Basic only/, "falls back to prd.dod when delivery.dod absent");

assert.match(CARA_PAKAI_MD, /TECHNICAL\.md/, "human guide mentions TECHNICAL.md");
assert.match(CARA_PAKAI_MD, /DELIVERY\.md/, "human guide mentions DELIVERY.md");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/render.test.mjs`
Expected: FAIL — bundle has 3 files, DoD fallback not implemented.

- [ ] **Step 3: Update `lib/render.ts`**

In `renderAgentOnboarding`, update the reading-order line to include new files:
```
You are implementing the product documented in the companion files: `PRD.md`, `BRAND_PACK.md`, `DESIGN_PACK.md`, `TECHNICAL.md`, `DELIVERY.md` (all in this repo/bundle). Read them in that order before writing any code, then follow the rules below.
```

Replace the DoD `sectionBody` call with fallback logic:
```typescript
const dodContent = sectionBody(sections, "delivery.dod", "") || sectionBody(sections, "prd.dod",
  `- Acceptance scenarios from the PRD pass.\n- Core logic has tests that fail before the fix and pass after.\n- Lint and typecheck are clean.\n- Accessibility basics hold: labels, keyboard, focus visible.`);
```

In `CARA_PAKAI_MD`, update the file list line:
```
Extract ZIP ini, lalu taruh semua file (PRD.md, BRAND_PACK.md, DESIGN_PACK.md, TECHNICAL.md, DELIVERY.md, AGENTS.md,
dan LOGO.svg bila ada) di folder utama (root) proyekmu — sejajar dengan kode aplikasinya.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types tests/render.test.mjs`
Expected: PASS — "render.test OK"

- [ ] **Step 5: Commit**

```bash
git add lib/render.ts tests/render.test.mjs
git commit -m "feat: render 5 packs in export, AGENTS.md DoD fallback to delivery.dod"
```

---

### Task 3: Create `/api/generate-all` SSE endpoint

**Files:**
- Create: `app/api/generate-all/route.ts`
- Test: manual verification (endpoint requires AI provider; test via curl in Step 4)

**Interfaces:**
- Consumes: `getSessionUser` from `lib/auth`, `getAiConfig`/`getProject`/`getSections`/`saveSection` from `lib/db`, `PACKS`/`PACK_ORDER`/`buildContext`/`buildSystemPrompt` from `lib/prompts`, `createOpenAI` from `@ai-sdk/openai`, `streamText` from `ai`.
- Produces: `POST /api/generate-all` with `{ projectId: number, idea: string }` → SSE stream of `section_start`/`chunk`/`section_done`/`section_skip`/`done`/`error` events.

- [ ] **Step 1: Write the endpoint**

`app/api/generate-all/route.ts`:
```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { getAiConfig, getProject, getSections, saveSection } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildContext, buildSystemPrompt, PACK_ORDER, PACKS } from "@/lib/prompts";

type GenerateBody = {
  projectId: number;
  idea: string;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as GenerateBody;
  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json(
      { error: "AI belum dikonfigurasi. Isi Base URL, API key, dan model di menu Pengaturan." },
      { status: 400 },
    );
  }

  const project = getProject(body.projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Build a mutable sections map: start from DB, update as we generate.
      let sectionsMap = new Map(getSections(body.projectId).map((s) => [s.key, s.content_md]));
      const allSectionDefs = PACK_ORDER.flatMap((packId) =>
        PACKS[packId].sections.map((s) => ({ packId, section: s })),
      );
      let generated = 0;
      let skipped = 0;

      for (const { packId, section } of allSectionDefs) {
        // Skip filled sections — never overwrite user work.
        if ((sectionsMap.get(section.key) ?? "").trim()) {
          send("section_skip", { key: section.key, title: section.title });
          skipped++;
          continue;
        }

        send("section_start", { pack: packId, key: section.key, title: section.title });

        const upstreamPacks = PACK_ORDER.slice(0, PACK_ORDER.indexOf(packId));
        const sectionsArray = [...sectionsMap.entries()].map(([key, content_md]) => ({ key, content_md }));
        const contextMd = buildContext(packId, sectionsArray, upstreamPacks);
        const system = buildSystemPrompt(packId, section, "generate", project.title, contextMd);

        try {
          const result = streamText({
            model: provider.chat(config.model),
            system,
            messages: [{ role: "user" as const, content: `Project idea: ${body.idea}\n\nWrite the "${section.enTitle}" section now based on this idea and the context from prior sections.` }],
          });

          let full = "";
          for await (const delta of result.textStream) {
            full += delta;
            send("chunk", { text: delta });
          }

          const match = full.match(/<content>([\s\S]*?)<\/content>/);
          const content = match?.[1]?.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
          if (content) {
            saveSection(body.projectId, section.key, content);
            sectionsMap.set(section.key, content);
            send("section_done", { pack: packId, key: section.key });
            generated++;
          } else {
            send("error", { message: "No content block found in AI response", section: section.key });
          }
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "AI call failed", section: section.key });
        }
      }

      send("done", { totalSections: allSectionDefs.length, generated, skipped });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify auth guard works**

Run: `curl -s -X POST http://localhost:3000/api/generate-all -H "Content-Type: application/json" -d '{"projectId":1,"idea":"test"}'`
Expected: `{"error":"Silakan masuk dulu"}` with status 401 (no session cookie).

- [ ] **Step 4: Commit**

```bash
git add app/api/generate-all/route.ts
git commit -m "feat: /api/generate-all SSE endpoint for sequential section generation"
```

---

### Task 4: Create `/api/validate` endpoint

**Files:**
- Create: `app/api/validate/route.ts`
- Test: manual verification (Step 3)

**Interfaces:**
- Consumes: `getSessionUser` from `lib/auth`, `getProject`/`getSections` from `lib/db`, `buildContext`/`buildValidationPrompt`/`PACK_ORDER` from `lib/prompts`, `createOpenAI` from `@ai-sdk/openai`, `generateText` from `ai`.
- Produces: `POST /api/validate` with `{ projectId: number }` → `{ findings: Finding[] }` where `Finding = { severity, section, message, suggestion }`.

- [ ] **Step 1: Write the endpoint**

`app/api/validate/route.ts`:
```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getAiConfig, getProject, getSections } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { buildContext, buildValidationPrompt, PACK_ORDER } from "@/lib/prompts";

type ValidateBody = { projectId: number };
type Finding = { severity: "error" | "warning" | "info"; section: string; message: string; suggestion: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Silakan masuk dulu" }, { status: 401 });

  const body = (await request.json()) as ValidateBody;
  const config = getAiConfig(user.id);
  if (!config.api_key || !config.model) {
    return Response.json({ error: "AI belum dikonfigurasi" }, { status: 400 });
  }

  const project = getProject(body.projectId);
  if (!project || project.user_id !== user.id) {
    return Response.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const sections = getSections(body.projectId);
  const allUpstream = PACK_ORDER;
  const contextMd = buildContext(PACK_ORDER[0], sections, allUpstream.slice(1));
  const prompt = buildValidationPrompt(contextMd);

  const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });

  try {
    const result = await generateText({
      model: provider.chat(config.model),
      system: prompt,
      messages: [{ role: "user" as const, content: "Validate this blueprint and return the findings JSON array." }],
    });

    const text = result.text.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    let findings: Finding[] = [];
    try {
      const parsed = JSON.parse(text);
      findings = Array.isArray(parsed) ? parsed : [];
    } catch {
      findings = [];
    }
    return Response.json({ findings });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Gagal menghubungi AI" },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify auth guard works**

Run: `curl -s -X POST http://localhost:3000/api/validate -H "Content-Type: application/json" -d '{"projectId":1}'`
Expected: `{"error":"Silakan masuk dulu"}` with status 401.

- [ ] **Step 4: Commit**

```bash
git add app/api/validate/route.ts
git commit -m "feat: /api/validate endpoint for AI cross-document consistency check"
```

---

### Task 5: Add Generate Blueprint dialog to editor

**Files:**
- Modify: `app/projects/[id]/editor.tsx`
- Test: manual verification (UI interaction)

**Interfaces:**
- Consumes: existing `Editor` component props, `PACK_ORDER`/`PACKS` from `lib/prompts`, `saveSectionAction` from `app/actions`.
- Produces: "Generate Blueprint" button → dialog with idea textarea → SSE consumption → progress UI → sections refresh.

- [ ] **Step 1: Add generate state and dialog to Editor component**

Add to the `Editor` component, before the return statement:

```typescript
const [showGenerate, setShowGenerate] = useState(false);
const [generateIdea, setGenerateIdea] = useState("");
const [generating, setGenerating] = useState(false);
const [generateProgress, setGenerateProgress] = useState<Record<string, "pending" | "generating" | "done" | "skip" | "error">>({});
const abortRef = useRef<AbortController | null>(null);

async function runGenerate() {
  if (!generateIdea.trim() || generating) return;
  setGenerating(true);
  const allSections = PACK_ORDER.flatMap((p) => PACKS[p].sections);
  const progress: Record<string, "pending" | "generating" | "done" | "skip" | "error"> = {};
  for (const s of allSections) progress[s.key] = "pending";
  setGenerateProgress(progress);

  const ac = new AbortController();
  abortRef.current = ac;

  try {
    const res = await fetch("/api/generate-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, idea: generateIdea.trim() }),
      signal: ac.signal,
    });
    if (!res.ok || !res.body) throw new Error("Gagal memulai generasi");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (let i = 0; i < lines.length; i += 2) {
        const eventLine = lines[i];
        const dataLine = lines[i + 1];
        if (!eventLine?.startsWith("event: ") || !dataLine?.startsWith("data: ")) continue;
        const evt = eventLine.slice(7).trim();
        const data = JSON.parse(dataLine.slice(6));
        if (evt === "section_start") setGenerateProgress((p) => ({ ...p, [data.key]: "generating" }));
        else if (evt === "section_done") setGenerateProgress((p) => ({ ...p, [data.key]: "done" }));
        else if (evt === "section_skip") setGenerateProgress((p) => ({ ...p, [data.key]: "skip" }));
        else if (evt === "error") setGenerateProgress((p) => data.section ? ({ ...p, [data.section]: "error" }) : p);
        else if (evt === "done") {
          toast.success(`Generasi selesai: ${data.generated} dibuat, ${data.skipped} dilewati.`);
        }
      }
    }
    // Refresh sections from server action
    window.location.reload();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      toast.info("Generasi dibatalkan.");
    } else {
      toast.error(err instanceof Error ? err.message : "Gagal menghubungi AI");
    }
  } finally {
    setGenerating(false);
    abortRef.current = null;
  }
}
```

- [ ] **Step 2: Add Generate Blueprint button and dialog to the header**

Add next to the existing "Unduh semua (ZIP)" button in the header `<div className="flex items-center gap-2">`:

```tsx
<Dialog open={showGenerate} onOpenChange={setShowGenerate}>
  <DialogTrigger render={<Button variant="cta" size="sm" aria-label="Generate blueprint dengan AI" />}>
    <Sparkles data-icon="inline-start" />
    Generate Blueprint
  </DialogTrigger>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle className="font-heading">Generate Blueprint dengan AI</DialogTitle>
      <DialogDescription>
        Tuliskan ide aplikasimu. AI akan mengisi semua bagian kosong secara berurutan —
        bagian yang sudah kamu isi tidak akan ditimpa.
      </DialogDescription>
    </DialogHeader>
    <Textarea
      value={generateIdea}
      onChange={(e) => setGenerateIdea(e.target.value)}
      placeholder="Contoh: Aplikasi manajemen tugas untuk tim kecil, dengan board Kanban, assignee, dan deadline..."
      className="min-h-32"
      aria-label="Ide aplikasi"
      disabled={generating}
    />
    {generating && (
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
        {PACK_ORDER.flatMap((p) => PACKS[p].sections).map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-2">
            <span className="truncate text-muted-foreground">{s.title}</span>
            <Badge variant={generateProgress[s.key] === "done" ? "default" : generateProgress[s.key] === "generating" ? "secondary" : generateProgress[s.key] === "error" ? "destructive" : generateProgress[s.key] === "skip" ? "outline" : "outline"} className="shrink-0 text-xs">
              {generateProgress[s.key] === "done" ? "✓" : generateProgress[s.key] === "generating" ? "..." : generateProgress[s.key] === "error" ? "!" : generateProgress[s.key] === "skip" ? "–" : "○"}
            </Badge>
          </div>
        ))}
      </div>
    )}
    <DialogFooter>
      {generating ? (
        <Button variant="outline" onClick={() => abortRef.current?.abort()}>
          Batal
        </Button>
      ) : (
        <DialogClose render={<Button variant="cta" onClick={() => void runGenerate()} disabled={!generateIdea.trim()} />}>
          Generate
        </DialogClose>
      )}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify visually**

Run: `npx next dev`, navigate to a project editor, click "Generate Blueprint", verify dialog opens with idea textarea and progress list.

- [ ] **Step 5: Commit**

```bash
git add app/projects/[id]/editor.tsx
git commit -m "feat: Generate Blueprint dialog with SSE progress UI"
```

---

### Task 6: Add Validation panel to editor

**Files:**
- Modify: `app/projects/[id]/editor.tsx`
- Test: manual verification

**Interfaces:**
- Consumes: `/api/validate` endpoint from Task 4, existing `selectSection` function.
- Produces: "Validasi" button → findings panel with severity grouping, section links.

- [ ] **Step 1: Add validation state and fetch logic**

Add to the `Editor` component state:
```typescript
const [validating, setValidating] = useState(false);
const [findings, setFindings] = useState<{ severity: "error" | "warning" | "info"; section: string; message: string; suggestion: string }[] | null>(null);
```

Add function:
```typescript
async function runValidation() {
  setValidating(true);
  setFindings(null);
  try {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "Gagal memvalidasi");
    }
    const data = (await res.json()) as { findings: typeof findings };
    setFindings(data.findings ?? []);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Gagal memvalidasi");
  } finally {
    setValidating(false);
  }
}
```

- [ ] **Step 2: Add Validasi button to header and findings panel**

Add next to the Generate button in the header:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => void runValidation()}
  disabled={validating || totalFilled === 0}
>
  {validating ? <Loader2 className="animate-spin" /> : <CircleCheck data-icon="inline-start" />}
  Validasi
</Button>
```

Add findings panel below the tabs header (after the `</Tabs>` closing tag, before the grid div):
```tsx
{findings && (
  <Card className={findings.some(f => f.severity === "error") ? "border-destructive/40" : ""}>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 font-heading text-base">
        {findings.length === 0 ? (
          <><CircleCheck className="size-4 text-primary" /> Semua konsisten</>
        ) : (
          <><CircleAlert className="size-4 text-primary" /> {findings.length} temuan</>
        )}
      </CardTitle>
    </CardHeader>
    {findings.length > 0 && (
      <CardContent className="space-y-2 pt-0">
        {findings.map((f, i) => (
          <div key={i} className="rounded-lg border border-border p-2.5 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant={f.severity === "error" ? "destructive" : f.severity === "warning" ? "default" : "secondary"} className="text-xs">
                {f.severity}
              </Badge>
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  for (const p of PACK_ORDER) {
                    if (PACKS[p].sections.some(s => s.key === f.section)) {
                      selectSection(p, f.section);
                      break;
                    }
                  }
                }}
              >
                {PACK_ORDER.flatMap(p => PACKS[p].sections).find(s => s.key === f.section)?.title ?? f.section}
              </button>
            </div>
            <p className="text-muted-foreground">{f.message}</p>
            {f.suggestion && <p className="mt-1 text-xs text-primary">→ {f.suggestion}</p>}
          </div>
        ))}
      </CardContent>
    )}
  </Card>
)}
```

Import `CircleCheck` and `CircleAlert` from lucide-react (add to the existing import line).

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify visually**

Run: `npx next dev`, navigate to a project with some sections filled, click "Validasi", verify findings panel appears (or "Semua konsisten" if no issues).

- [ ] **Step 5: Commit**

```bash
git add app/projects/[id]/editor.tsx
git commit -m "feat: validation panel with severity badges and section links"
```

---

### Task 7: Verify full flow end-to-end and run all tests

**Files:**
- No new files — verification only.

- [ ] **Step 1: Run all existing tests**

Run: `node --experimental-strip-types tests/render.test.mjs && node --experimental-strip-types tests/prompts.test.mjs && node --experimental-strip-types tests/auth.test.mjs`
Expected: all pass.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: ESLint check**

Run: `npx eslint lib/prompts.ts lib/render.ts app/api/generate-all/route.ts app/api/validate/route.ts app/projects/[id]/editor.tsx`
Expected: no errors.

- [ ] **Step 4: Manual end-to-end test**

Run: `npx next dev`
1. Create a new project.
2. Click "Generate Blueprint", enter an idea, submit.
3. Verify SSE progress updates section by section.
4. Verify sections are filled in the editor after generation.
5. Click "Validasi", verify findings panel.
6. Click a finding's section link, verify it navigates to the section.
7. Click "Unduh semua (ZIP)", verify ZIP contains all 5 pack files + AGENTS.md + CARA_PAKAI.md.
8. Open AGENTS.md, verify single DoD block (delivery.dod or prd.dod fallback).

- [ ] **Step 5: Update graph**

Run: `graphify update .`
Expected: graph updated with new nodes for technical/delivery packs.

- [ ] **Step 6: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: verify full blueprint flow end-to-end"
```
