# PRD Review Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-button "Tinjau PRD" pass that reads the plan + all 12 PRD sections in a single AI call and returns `findings[]`, routed by evidence (a cited rule + a deterministic verifier) and by an AI-assigned weight: provable → auto-fix, non-provable `high` → a decision for the user, `medium`/`low` → a note.

**Architecture:** Pure logic lives in `lib/review.ts` (tolerant parse, deterministic verifier, weight router, escalation→decision mapping); the prompt lives in `lib/prompts.ts`; a new `POST /api/prd/review` runs one `streamText` call, routes the findings, saves fixes to `sections` and escalations to `plan_json`, and returns a summary. The editor gains a button and a result card; the existing `DecisionPanel` renders escalations.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@ai-sdk/openai` + `ai`, better-sqlite3, Tailwind 4 + Base UI, tests via `node --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-13-prd-review-pass-design.md`

## Global Constraints

- No new runtime dependency; stdlib/existing deps first.
- `lib/prompts.ts` is the single source of truth for every prompt (add `buildReviewPrompt` there; do not restate prompt text elsewhere).
- Conversation/UI copy is **Indonesian**; document content inside `<content>` is **English**.
- Never fetch a project by id alone — always `getOwnedProject(user.id, id)`; API routes guard with `getSessionUser()` (401).
- Section keys are the 12 in `PRD_SECTIONS` (`lib/prompts.ts`); a fixed section heading is exactly `### <enTitle>`.
- Tests run as `node --experimental-strip-types tests/<name>.test.mjs` (flat `node:assert`, no framework). End each with `console.log("<name>.test OK")`.
- Verify before claiming done: `npx tsc --noEmit` and `npx eslint <changed files>`.
- UI primitives from `@base-ui/react` + `components/ui/`; icons from `lucide-react`; toasts `sonner`; follow `design-system/specly/MASTER.md`.
- No auto-run: the pass fires only when the user presses the button.
- No schema change: fixes → `sections` via `saveSection`; escalations → `plan_json` via `savePlan` + `mergeDecisions`; notes are returned only.

## Review Focus

The spec's silence on these inputs is not permission for them to break the software. Each line is pinned by a test in the owning task (Task 1 unless noted).

1. A weak model returns fenced, prose-wrapped, or truncated JSON → `parseReview` must never throw and must degrade to `{ findings: [] }`.
2. A "fix" that silently drops a `US/FR/AS/NFR-n` ID or changes the section heading → the verifier must reject it (no save).
3. A finding names an unknown or duplicate section key, or a Tier 2 removal is claimed but `removed`/`rule` is missing → routed to a note, never applied.
4. `POST /api/prd/review` when the PRD is entirely empty → 409 with a clear message, no AI call (Task 3).
5. A `weight: "high"` finding without usable `options` → degrades to a note, never an error, and never a broken decision.
6. Undo after an applied fix restores the exact prior content (manual check, Task 4).

---

### Task 1: `lib/review.ts` — parse, verify, route

**Files:**
- Create: `lib/review.ts`
- Test: `tests/review.test.mjs`
- Modify: `docs/architecture.md` (module map), `docs/development.md` (test table), `AGENTS.md` (verify list)

**Interfaces:**
- Consumes: `PRD_SECTIONS` from `./prompts.ts`; `Decision`, `Plan` types from `./plan.ts`.
- Produces:
  - `type ReviewWeight = "high" | "medium" | "low"`
  - `type ReviewFinding = { section: string; weight: ReviewWeight; issue: string; rule?: string; from?: string; to?: string; revisedContent?: string; removed?: string; options?: string[]; recommended?: string }`
  - `type ReviewResult = { findings: ReviewFinding[] }`
  - `function parseReview(raw: string): ReviewResult`
  - `function collectIds(md: string): string[]`
  - `function verifyFix(finding: ReviewFinding, before: string, enTitle: string): boolean`
  - `type Routed = { kind: "fix" | "escalation" | "note"; finding: ReviewFinding }`
  - `function routeFinding(finding: ReviewFinding, before: string, enTitle: string): Routed`
  - `type ReviewPlan = { fixes: { finding: ReviewFinding; key: string; before: string }[]; escalations: { finding: ReviewFinding; key: string }[]; notes: ReviewFinding[] }`
  - `function planReview(findings: ReviewFinding[], sections: { key: string; content_md: string }[]): ReviewPlan`
  - `function escalationToDecision(finding: ReviewFinding, id: string): Decision`

- [ ] **Step 1: Write the failing test**

Create `tests/review.test.mjs`:

```js
import assert from "node:assert";
import {
  parseReview,
  collectIds,
  verifyFix,
  routeFinding,
  planReview,
  escalationToDecision,
} from "../lib/review.ts";

// --- parseReview: tolerant, never throws (Review Focus 1, 3) ---
assert.deepEqual(parseReview("no json here"), { findings: [] });
assert.deepEqual(parseReview('```json\n{"findings":[]}\n```'), { findings: [] });
const one = parseReview('{"findings":[{"section":"prd.entities","weight":"high","issue":"x"}]}');
assert.equal(one.findings.length, 1);
assert.equal(one.findings[0].weight, "high");
// unknown weight coerces to low; a non-array findings field is empty
assert.equal(parseReview('{"findings":[{"section":"a","weight":"weird","issue":"i"}]}').findings[0].weight, "low");
assert.deepEqual(parseReview('{"findings":"nope"}'), { findings: [] });

// --- collectIds ---
assert.deepEqual(collectIds("US-1 FR-2 AS-3 NFR-4"), ["US-1", "FR-2", "AS-3", "NFR-4"]);
assert.deepEqual(collectIds("nothing"), []);

// --- verifyFix: Tier 1 rename keeps IDs + heading ---
const beforeRename = "### Key Entities\n| Entity | Notes |\n| Item | x |\n- FR-1 uses Item";
const rename = {
  section: "prd.entities",
  weight: "low",
  issue: "canonical name",
  rule: "canonical name: Produk",
  from: "Item",
  to: "Produk",
  revisedContent: "### Key Entities\n| Entity | Notes |\n| Produk | x |\n- FR-1 uses Produk",
};
assert.equal(verifyFix(rename, beforeRename, "Key Entities"), true);
// dropped ID is rejected (Review Focus 2)
assert.equal(
  verifyFix({ ...rename, revisedContent: "### Key Entities\n| Produk | x |" }, beforeRename, "Key Entities"),
  false,
);
// changed heading is rejected
assert.equal(
  verifyFix({ ...rename, revisedContent: "### Entities\n| Produk | x |\n- FR-1" }, beforeRename, "Key Entities"),
  false,
);
// empty / unchanged content is rejected
assert.equal(verifyFix({ ...rename, revisedContent: "" }, beforeRename, "Key Entities"), false);
assert.equal(verifyFix({ ...rename, revisedContent: beforeRename }, beforeRename, "Key Entities"), false);
// canonical term must appear when the rule cites one
assert.equal(
  verifyFix({ ...rename, revisedContent: "### Key Entities\n| Item | x |\n- FR-1" }, beforeRename, "Key Entities"),
  false,
);

// --- verifyFix: Tier 2 removal must declare removed + rule ---
const beforeDrop = "### Goals\n### Non-Goals\n- offline\n### Functional Requirements\n- FR-1 online\n- FR-2 offline mode";
const drop = {
  section: "prd.functional",
  weight: "high",
  issue: "FR-2 restates a Non-Goal",
  rule: "Non-Goal: offline",
  removed: "- FR-2 offline mode",
  revisedContent: "### Functional Requirements\n- FR-1 online",
};
assert.equal(verifyFix(drop, beforeDrop, "Functional Requirements"), true, "removal with removed+rule drops FR-2");
assert.equal(verifyFix({ ...drop, removed: "" }, beforeDrop, "Functional Requirements"), false, "no removed => reject");
assert.equal(verifyFix({ ...drop, rule: "" }, beforeDrop, "Functional Requirements"), false, "no rule => reject");
assert.equal(
  verifyFix({ ...drop, revisedContent: beforeDrop }, beforeDrop, "Functional Requirements"),
  false,
  "removed text still present => reject",
);

// --- routeFinding ---
assert.equal(routeFinding(rename, beforeRename, "Key Entities").kind, "fix");
assert.equal(routeFinding({ section: "s", weight: "high", issue: "i" }, "x", "T").kind, "note", "high w/o options => note");
assert.equal(
  routeFinding({ section: "s", weight: "high", issue: "i", options: ["a", "b"] }, "x", "T").kind,
  "escalation",
);
assert.equal(routeFinding({ section: "s", weight: "medium", issue: "i", options: ["a"] }, "x", "T").kind, "note");
assert.equal(routeFinding({ section: "s", weight: "low", issue: "i" }, "x", "T").kind, "note");

// --- planReview: unknown section key is a note, not a fix (Review Focus 3) ---
const sections = [{ key: "prd.entities", content_md: beforeRename }];
const plan = planReview([rename, { section: "prd.nope", weight: "high", issue: "i" }], sections);
assert.equal(plan.fixes.length, 1);
assert.equal(plan.fixes[0].key, "prd.entities");
assert.equal(plan.fixes[0].before, beforeRename);
assert.equal(plan.notes.length, 1);

// --- escalationToDecision ---
const dec = escalationToDecision(
  { section: "prd.functional", weight: "high", issue: "offline?", options: ["online only", "offline too"], recommended: "online only" },
  "R1",
);
assert.equal(dec.id, "R1");
assert.equal(dec.question, "offline?");
assert.equal(dec.options[0], "online only");
assert.equal(dec.recommended, "online only");
assert.equal(dec.chosen, "online only");

console.log("review.test OK");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/review.test.mjs`
Expected: FAIL — `Cannot find module .../lib/review.ts`.

- [ ] **Step 3: Implement `lib/review.ts`**

Mirror the tolerant parser in `lib/plan.ts` (`parsePlan`) and `lib/discovery.ts` (`parseDiscoveryTurn`): strip ```json fences, try `JSON.parse`, then the first balanced `{ … }` span (copy the string-aware `extractJsonObject`), and on failure return `{ findings: [] }`.

- `parseReview`: keep only array items that are objects; for each, `section = str(section)`, `weight = ["high","medium","low"].includes(w) ? w : "low"`, copy `issue/rule/from/to/revisedContent/removed/recommended` as strings (empty → omitted/`""`), `options` as a string array. Skip items with an empty `section` **only if** they also lack a `rule`+`revisedContent` (a section-less fix is unusable → drop it).
- `collectIds`: `md.match(/\b(?:US|FR|AS|NFR)-\d+\b/g) ?? []`.
- `verifyFix`: apply the four checks in the spec's verifier section: non-empty and `!== before`; heading preserved when `before.trim().startsWith("###")` (require `revised.trim().startsWith("### " + enTitle)` in that case); every ID in `collectIds(before)` present in `collectIds(revised)` unless Tier 2 (`removed` non-empty **and** `rule` non-empty **and** `!revised.includes(removed)`); when `rule` contains a canonical term (`to` non-empty) require `revised.includes(to)`. Any failure → `false`.
- `routeFinding`: `rule` non-empty **and** `revisedContent` non-empty **and** `verifyFix(...)` → `{ kind: "fix", finding }`; else `weight === "high"` **and** `options.length > 0` → `"escalation"`; else `"note"`. Note: `verifyFix` needs `before`/`enTitle`, so `routeFinding` takes them too.
- `planReview`: for each finding, look up `PRD_SECTIONS` by `finding.section`; unknown key → `notes`. Else `routeFinding(finding, content, enTitle)`; bucket accordingly. `fixes[].before` = the section's `content_md` (or `""`).
- `escalationToDecision`: `{ id, label: finding.issue.slice(0, 80), question: finding.issue, recommended: finding.recommended ?? finding.options![0], options: finding.options!, chosen: recommended }`.

`shortcut:` the verifier trusts the `rule` citation for Tier 2 removals instead of re-deriving it from the plan; the citation + `removed` text are shown in the UI and the removal is undoable. Upgrade path: validate `rule` against the plan's Non-Goals / chosen decisions.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/review.test.mjs`
Expected: `review.test OK`.

- [ ] **Step 5: Update docs**

- `docs/architecture.md`: add `lib/review.ts` to the module map ("PRD review pass: tolerant findings parser, deterministic verifier, weight router, escalation→decision mapping").
- `docs/development.md`: add a `| review | review pass parse + verifier + routing |` row to the test table.
- `AGENTS.md`: add `node --experimental-strip-types tests/review.test.mjs` to the verify block.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit && npx eslint lib/review.ts tests/review.test.mjs
git add lib/review.ts tests/review.test.mjs docs/architecture.md docs/development.md AGENTS.md
git commit -m "feat(review): findings parser, verifier, and weight router"
```

---

### Task 2: `buildReviewPrompt`

**Files:**
- Modify: `lib/prompts.ts`
- Test: `tests/prompts.test.mjs`

**Interfaces:**
- Consumes: `Plan`, `planText` from `./plan.ts`; `PRD_SECTIONS`, `CONSISTENCY_RULES`, `APP_PLAYBOOK` (in-file).
- Produces: `function buildReviewPrompt(projectTitle: string, plan: Plan, sections: { key: string; content_md: string }[]): string`

- [ ] **Step 1: Write the failing assertion**

Append to `tests/prompts.test.mjs` (before the final `console.log`), and add `buildReviewPrompt` to the import from `../lib/prompts.ts`:

```js
const rev = buildReviewPrompt(
  "Warung",
  parsePlan("{}"),
  [
    { key: "prd.entities", content_md: "### Key Entities\n| Item | x |" },
    { key: "prd.goals", content_md: "" },
  ],
);
assert.match(rev, /fresh eyes|did not write|reviewer/i, "review prompt sets the fresh-eyes reviewer role");
assert.match(rev, /"findings"/, "review prompt defines the findings contract");
assert.match(rev, /weight/, "review prompt asks for a weight");
assert.match(rev, /high|medium|low/, "review prompt names the weight levels");
assert.match(rev, /"rule"/, "review prompt requires a rule citation for fixes");
assert.match(rev, /Non-Goals|Non-Goal/i, "review prompt anchors the out-of-scope rule");
assert.match(rev, /Terminology|canonical name/i, "review prompt carries the canonical terminology");
assert.match(rev, /App Playbook/, "review prompt carries the playbook");
assert.match(rev, /### Key Entities\n\| Item \| x \|/, "review prompt inlines the section content");
assert.doesNotMatch(rev, /### Goals\n_Belum diisi_/, "empty sections are listed as empty, not inlined");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: FAIL — `buildReviewPrompt is not a function`.

- [ ] **Step 3: Implement `buildReviewPrompt` in `lib/prompts.ts`**

Add it next to the other builders. It must:

- Open with the reviewer role: it reviews a finished PRD **with fresh eyes**, it did **not** write it, and it has no access to the discovery chat.
- Inline the **rubric** (the four objectives from the spec: faithful to the user's chosen decisions and description; not over-engineered — no invented scope/feature/implementation detail; best-practice structure — IDs, story↔FR traces, scenarios name their story, no bare headings/TODOs; cheap — report, do not pad).
- Inline `CONSISTENCY_RULES` and, after it, the canonical terminology by including `planText(plan)` under `The plan:`.
- Inline `APP_PLAYBOOK`.
- List every section as either `## <enTitle> (<key>)` followed by its content, or `<...> — empty`. Do **not** inline the `_Belum diisi._` placeholder text for empty sections.
- Hard rules (as a bulleted list): rewrite a section only for Tier 1 (align: canonical name, repoint a unique dangling reference, normalise the heading) or Tier 2 (drop an out-of-scope item that restates a Non-Goal or contradicts a chosen decision; drop a dangling reference with no unique target; collapse an exact duplicate; strip invented implementation detail); every fix cites `rule`; weigh each non-provable finding `high|medium|low` and state what a `high` changes in the build; a `high` needs real `options` + `recommended`; Tier 2 removals name their basis and return `removed`; never invent facts or delete a story/requirement/scenario without a Tier 2 basis; do not manufacture findings; reply with ONLY the JSON object.
- End with the output contract: one JSON object with a single `findings` array, each entry exactly the shape `{ section, weight, issue, rule, from, to, revisedContent, removed, options, recommended }` (fields optional except `section`, `weight`, `issue`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types tests/prompts.test.mjs`
Expected: `prompts.test OK`.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npx eslint lib/prompts.ts tests/prompts.test.mjs
git add lib/prompts.ts tests/prompts.test.mjs
git commit -m "feat(review): add buildReviewPrompt"
```

---

### Task 3: `POST /api/prd/review`

**Files:**
- Create: `app/api/prd/review/route.ts`
- Modify: `docs/architecture.md` (request flow + API surface)

**Interfaces:**
- Consumes: `parseReview`, `planReview`, `escalationToDecision` from `@/lib/review`; `buildReviewPrompt` from `@/lib/prompts`; `getAiConfig`, `getOwnedProject`, `getPlan`, `getSections`, `savePlan`, `saveSection` from `@/lib/db`; `getSessionUser` from `@/lib/auth`; `hasAnyContent` from `@/lib/prd`; `minimalPlan`, `mergeDecisions` from `@/lib/plan`.
- Produces: a route returning `{ applied: { key, issue, rule, before, removed, after }[], escalated: number, notes: { section, weight, issue }[], decisions: Decision[], usage: { input: number; output: number } }`.

- [ ] **Step 1: Implement the route**

Mirror the guard block of `app/api/prd/decisions/route.ts`. Steps inside the handler:

1. `getSessionUser()` → 401 `{ error: "Silakan masuk dulu" }`.
2. Parse `{ projectId }` (integer > 0) → 400.
3. `getOwnedProject(user.id, projectId)` → 404.
4. `getAiConfig(user.id)`; require `api_key` and `model` → 400.
5. `const sections = getSections(projectId);` if `!hasAnyContent(sections)` → 409 `{ error: "Belum ada PRD untuk ditinjau" }` (no AI call) — **Review Focus 4**.
6. `const plan = getPlan(projectId) ?? minimalPlan();`
7. One call:
   ```ts
   const provider = createOpenAI({ baseURL: config.base_url, apiKey: config.api_key });
   const result = streamText({
     model: provider.chat(config.model),
     system: buildReviewPrompt(project.title, plan, sections),
     messages: [{ role: "user", content: "Review the PRD now." }],
     abortSignal: request.signal,
   });
   const text = await result.text;
   ```
   Wrap in try/catch → 500 `{ error }`.
8. Read usage tolerantly (confirm the property against the installed `ai` version; fall back to zeros if absent):
   ```ts
   let usage = { input: 0, output: 0 };
   try { const u = await result.usage; usage = { input: u?.inputTokens ?? 0, output: u?.outputTokens ?? 0 }; } catch {}
   ```
9. `const { fixes, escalations, notes } = planReview(parseReview(text).findings, sections);`
10. Apply fixes and collect `applied`:
    ```ts
    const applied = fixes.map(({ finding, key, before }) => {
      const after = finding.revisedContent!;
      saveSection(projectId, key, after);
      return { key, issue: finding.issue, rule: finding.rule ?? "", before, removed: finding.removed ?? "", after };
    });
    ```
11. Escalations → decisions without dropping existing ones:
    ```ts
    const next = escalations.map((e, i) => escalationToDecision(e.finding, `R${i + 1}`));
    const merged = next.length ? mergeDecisions(plan, next) : plan;
    if (next.length) savePlan(projectId, merged);
    ```
12. Return `Response.json({ applied, escalated: escalations.length, notes: notes.map((n) => ({ section: n.section, weight: n.weight === "high" ? "medium" : n.weight, issue: n.issue })), decisions: merged.decisions, usage })`.

`shortcut:` the route is one non-streamed call and returns JSON (no SSE) — a review is a single result, so a spinner in the editor is enough. Upgrade path: stream `findings` if reviews get slow.

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc --noEmit && npx eslint app/api/prd/review/route.ts`
Expected: clean. (No live AI endpoint here, so the handler is verified by types/lint and by the manual run in Task 4.)

- [ ] **Step 3: Update `docs/architecture.md`**

Add `/api/prd/review` to the API surface and the request-flow paragraph ("after the draft, the user may run the review pass: one call reads the plan + 12 sections and routes findings into fixes, escalations, and notes").

- [ ] **Step 4: Commit**

```bash
git add app/api/prd/review/route.ts docs/architecture.md
git commit -m "feat(review): POST /api/prd/review one-call review pass"
```

---

### Task 4: Editor button, result card, and escalation wiring

**Files:**
- Modify: `app/projects/[id]/editor.tsx`
- Modify: `components/decision-panel.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `saveSectionAction` (already imported in `editor.tsx`), the route from Task 3, and the existing `DecisionPanel`.

- [ ] **Step 1: Sync `DecisionPanel` to inbound plan changes**

`DecisionPanel` initialises `decisions`/`custom` from `plan` once. Add an effect after the `useState` declarations in `components/decision-panel.tsx` so escalations appear when the parent replaces the plan:

```ts
useEffect(() => {
  const ds = plan?.decisions ?? [];
  setDecisions(ds);
  setCustom(Object.fromEntries(ds.filter((d) => !d.options.includes(d.chosen)).map((d) => [d.id, d.chosen])));
  setDirty(false);
  setSaved(false);
}, [plan]);
```

Add `useEffect` to the existing `react` import.

`shortcut:` this resets unsaved panel edits if a review lands mid-edit. Acceptable — review is explicit and rare. Upgrade path: merge by decision id instead of resetting.

- [ ] **Step 2: Add review state and handlers in `editor.tsx`**

Near the other `useState` declarations (after `refineLive`), add a named result type and the state:

```ts
type ReviewApplied = { key: string; issue: string; rule: string; before: string; after: string; removed?: string };
type ReviewSummary = {
  applied: ReviewApplied[];
  escalated: number;
  notes: { section: string; weight: string; issue: string }[];
  decisions: Plan["decisions"];
  usage: { input: number; output: number };
};
```

```ts
const [planState, setPlanState] = useState<Plan | null>(plan);
const [reviewing, setReviewing] = useState(false);
const [review, setReview] = useState<ReviewSummary | null>(null);
```

Handlers (next to `refineSection`):

```ts
async function reviewPrd() {
  if (reviewing) return;
  setReviewing(true);
  try {
    const res = await fetch("/api/prd/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    const j = (await res.json().catch(() => ({}))) as ReviewSummary & { error?: string };
    if (!res.ok || !j.applied) throw new Error(j.error ?? "Gagal meninjau PRD");
    setSections((s) => {
      const next = { ...s };
      for (const f of j.applied) next[f.key] = f.after;
      return next;
    });
    setPlanState((p) => (p ? { ...p, decisions: j.decisions } : p));
    setReview(j);
    toast.success(`${j.applied.length} dirapikan · ${j.escalated} perlu keputusanmu`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Gagal meninjau PRD");
  } finally {
    setReviewing(false);
  }
}

async function undoReview() {
  if (!review || review.applied.length === 0) return;
  try {
    for (const f of review.applied) await saveSectionAction(project.id, f.key, f.before);
    setSections((s) => {
      const next = { ...s };
      for (const f of review.applied) next[f.key] = f.before;
      return next;
    });
    setReview(null);
    toast.success("Perbaikan dibatalkan.");
  } catch {
    toast.error("Gagal membatalkan perbaikan.");
  }
}
```

The response `applied[]` already carries `after`, so `ReviewSummary` types it directly — no casts.

- [ ] **Step 3: Render the button and result card**

In the PRD `CardContent` (the `flex flex-wrap items-center gap-2` block that holds *Buat ulang*, ~`editor.tsx:640`), add next to the CTA:

```tsx
{hasContent && !generating && (
  <Button variant="outline" onClick={() => void reviewPrd()} disabled={reviewing}>
    {reviewing ? <Loader2 className="animate-spin" /> : <Search data-icon="inline-start" />}
    {reviewing ? "Meninjau PRD…" : "Tinjau PRD"}
  </Button>
)}
```

Add `Search` to the `lucide-react` import. Below the button row, render the result card when `review` is set:

- A line: `{review.applied.length} dirapikan · {review.escalated} perlu keputusanmu · {review.notes.length} catatan`, plus a muted `~{review.usage.input + review.usage.output} token`.
- A `<details>` per applied fix: `<summary>{issue}</summary>` then the `rule`, a two-column before/after (`<pre>` or muted blocks), and the `removed` text if present.
- If `review.notes.length`: a `<details><summary>Buka catatan</summary>` listing each note (`section` + `issue`), weight shown as a small badge.
- A `Batalkan perbaikan` button calling `undoReview()`.

Use only `components/ui/` primitives + Tailwind tokens from `design-system/specly/MASTER.md`; keep copy Indonesian; ensure the toggle is a real `<details>`/button (keyboard-operable) and focus is visible.

- [ ] **Step 4: Wire `planState` into `DecisionPanel`**

Change `<DecisionPanel plan={plan} ...>` to `<DecisionPanel plan={planState} ...>` so escalations render without a page refresh.

- [ ] **Step 5: Verify build, lint, and behavior**

Run: `npx tsc --noEmit && npx eslint "app/projects/[id]/editor.tsx" components/decision-panel.tsx && npm run build`
Expected: clean build.

Manual (needs a real endpoint): draft a PRD, press **Tinjau PRD**, confirm fixes appear (before/after), a `high` finding appears in **Keputusan yang dipakai**, **Batalkan perbaikan** restores the exact prior text, and `Plan` state shows the new decision ids (`R1…`).

- [ ] **Step 6: Update `README.md` and commit**

Add one Indonesian line to the workflow section: after the PRD draft, the user may press **Tinjau PRD** to have the AI align the sections to the canonical terms and surface decisions that need the user.

```bash
git add "app/projects/[id]/editor.tsx" components/decision-panel.tsx README.md
git commit -m "feat(review): editor button, result card, and escalation wiring"
```

---

## Final Verification

Run the whole suite plus the required checks:

```bash
npx tsc --noEmit
npx eslint lib/review.ts lib/prompts.ts app/api/prd/review/route.ts "app/projects/[id]/editor.tsx" components/decision-panel.tsx tests/review.test.mjs
for t in auth db-messages prd prompts render sse plan db-plan db-ownership concurrency discovery db-discovery estimate ai-config review; do node --experimental-strip-types "tests/$t.test.mjs" || echo "FAIL $t"; done
```
Expected: `tsc` clean, `eslint` clean, every suite prints `… OK`.
