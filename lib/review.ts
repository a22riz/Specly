import { PRD_SECTIONS } from "./prompts.ts";
import type { Decision } from "./plan.ts";

/** How much a finding matters: high → escalate, low/medium → note if unfixable. */
export type ReviewWeight = "high" | "medium" | "low";

export type ReviewFinding = {
  section: string;
  weight: ReviewWeight;
  issue: string;
  rule?: string;
  from?: string;
  to?: string;
  revisedContent?: string;
  removed?: string;
  options?: string[];
  recommended?: string;
};

export type ReviewResult = { findings: ReviewFinding[] };

/** First balanced `{ … }` span in the text, or null. String-aware. */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

const WEIGHTS: ReviewWeight[] = ["high", "medium", "low"];

/** Keep only object entries; an unknown weight coerces to "low". */
function normalizeFinding(v: unknown): ReviewFinding | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const section = str(o.section).trim();
  const rule = str(o.rule).trim();
  const revisedContent = str(o.revisedContent).trim();
  // A section-less finding cannot be routed; keep it only when it carries a
  // concrete fix payload (rule + revised content), otherwise drop it.
  if (!section && !(rule && revisedContent)) return null;
  const w = str(o.weight).trim();
  const weight: ReviewWeight = WEIGHTS.includes(w as ReviewWeight) ? (w as ReviewWeight) : "low";
  const finding: ReviewFinding = { section, weight, issue: str(o.issue) };
  if (rule) finding.rule = rule;
  if (str(o.from)) finding.from = str(o.from);
  if (str(o.to)) finding.to = str(o.to);
  if (revisedContent) finding.revisedContent = revisedContent;
  if (str(o.removed)) finding.removed = str(o.removed);
  if (str(o.recommended)) finding.recommended = str(o.recommended);
  if (Array.isArray(o.options)) {
    const options = o.options.map(str).map((s) => s.trim()).filter((s) => s !== "");
    if (options.length) finding.options = options;
  }
  return finding;
}

function normalizeReview(raw: unknown): ReviewResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.findings)) return { findings: [] };
  const findings: ReviewFinding[] = [];
  for (const item of o.findings) {
    const finding = normalizeFinding(item);
    if (finding) findings.push(finding);
  }
  return { findings };
}

/**
 * Tolerant JSON parser: strips ```json fences, tries `JSON.parse`, then the
 * first balanced `{ … }` span. Never throws — prose degrades to `{ findings: [] }`.
 */
export function parseReview(raw: string): ReviewResult {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  for (const candidate of [stripped, extractJsonObject(stripped)]) {
    if (!candidate) continue;
    try {
      return normalizeReview(JSON.parse(candidate));
    } catch {
      // try next candidate
    }
  }
  return { findings: [] };
}

/** Traceable IDs (US-1, FR-2, AS-3, NFR-4) in a section's markdown. */
export function collectIds(md: string): string[] {
  return md.match(/\b(?:US|FR|AS|NFR)-\d+\b/g) ?? [];
}

/**
 * Gate a proposed rewrite before it can become a "fix": non-empty and changed,
 * same heading, no traceable ID lost (unless a cited removal explains it), and
 * the canonical term the rule cites must actually appear.
 */
export function verifyFix(finding: ReviewFinding, before: string, enTitle: string): boolean {
  const revised = (finding.revisedContent ?? "").trim();
  if (!revised || revised === before.trim()) return false;
  if (before.trim().startsWith("###") && !revised.startsWith("### " + enTitle)) return false;
  const rule = (finding.rule ?? "").trim();
  const removed = (finding.removed ?? "").trim();
  // Tier 2: a declared removal (with a rule citing why) licenses dropping IDs.
  // shortcut: the verifier trusts the rule citation instead of re-deriving it
  // from the plan. The citation + removed text are shown in the UI and the
  // removal is undoable. Upgrade: validate rule against the plan's Non-Goals
  // / chosen decisions.
  const removal = removed !== "" && rule !== "" && !revised.includes(removed);
  if (!removal) {
    const after = new Set(collectIds(revised));
    if (collectIds(before).some((id) => !after.has(id))) return false;
  }
  const to = (finding.to ?? "").trim();
  if (to && !revised.includes(to)) return false;
  return true;
}

export type Routed = { kind: "fix" | "escalation" | "note"; finding: ReviewFinding };

/** A verified rewrite is a fix; an unfixable high finding with options escalates. */
export function routeFinding(finding: ReviewFinding, before: string, enTitle: string): Routed {
  const fixable =
    (finding.rule ?? "").trim() !== "" &&
    (finding.revisedContent ?? "").trim() !== "" &&
    verifyFix(finding, before, enTitle);
  if (fixable) return { kind: "fix", finding };
  if (finding.weight === "high" && (finding.options?.length ?? 0) > 0) {
    return { kind: "escalation", finding };
  }
  return { kind: "note", finding };
}

export type ReviewPlan = {
  fixes: { finding: ReviewFinding; key: string; before: string }[];
  escalations: { finding: ReviewFinding; key: string }[];
  notes: ReviewFinding[];
};

/** Bucket findings against the stored sections; unknown keys fall to notes. */
export function planReview(
  findings: ReviewFinding[],
  sections: { key: string; content_md: string }[],
): ReviewPlan {
  const plan: ReviewPlan = { fixes: [], escalations: [], notes: [] };
  const contentByKey = new Map(sections.map((s) => [s.key, s.content_md]));
  for (const finding of findings) {
    const def = PRD_SECTIONS.find((s) => s.key === finding.section);
    if (!def) {
      plan.notes.push(finding);
      continue;
    }
    const before = contentByKey.get(finding.section) ?? "";
    const routed = routeFinding(finding, before, def.enTitle);
    if (routed.kind === "fix") {
      plan.fixes.push({ finding, key: finding.section, before });
    } else if (routed.kind === "escalation") {
      plan.escalations.push({ finding, key: finding.section });
    } else {
      plan.notes.push(finding);
    }
  }
  // One fix per section: a later finding for the same key replaces the earlier
  // one, since the route applies each against the same `before` (two writes for
  // one key would silently supersede one another).
  const byKey = new Map(plan.fixes.map((f) => [f.key, f]));
  plan.fixes = [...byKey.values()];
  return plan;
}

/**
 * Map an escalation to a plan decision so the user can answer it like any other
 * plan question. Recommended falls back to the first option.
 */
export function escalationToDecision(finding: ReviewFinding, id: string): Decision {
  const options = finding.options ?? [];
  const recommended = finding.recommended || options[0] || "";
  return {
    id,
    label: finding.issue.slice(0, 80),
    question: finding.issue,
    recommended,
    options,
    chosen: recommended,
  };
}
