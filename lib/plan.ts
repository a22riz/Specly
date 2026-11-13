export type Decision = {
  id: string;
  label: string;
  question: string;
  recommended: string;
  options: string[];
  chosen: string;
};

export type Assumption = { id: string; label: string; note: string };

export type GlossaryEntry = { term: string; meaning: string };

/**
 * Canonical names every PRD section must reuse verbatim. Defined once in the plan
 * so sections drafted in parallel cannot drift into synonyms ("Product" vs "Item")
 * or rename roles.
 */
export type Terminology = {
  entities: string[];
  roles: string[];
  glossary: GlossaryEntry[];
};

export type Plan = {
  category: string;
  industry: string;
  scale: string;
  platform: string;
  decisions: Decision[];
  assumptions: Assumption[];
  terminology: Terminology;
  outline: Record<string, string>;
};

export function emptyTerminology(): Terminology {
  return { entities: [], roles: [], glossary: [] };
}

/** Empty plan used when nothing parseable is available. */
export function minimalPlan(): Plan {
  return {
    category: "",
    industry: "",
    scale: "",
    platform: "",
    decisions: [],
    assumptions: [],
    terminology: emptyTerminology(),
    outline: {},
  };
}

/**
 * Coerce arbitrary input into well-formed decisions: keep only object entries
 * that carry a non-empty id (mergeDecisions and the UI key on id), and normalize
 * every field. Used by both the tolerant plan parser and the save-decisions
 * action, so a malformed client payload cannot reach storage.
 */
export function normalizeDecisions(raw: unknown): Decision[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (d): d is Record<string, unknown> =>
        typeof d === "object" && d !== null && str((d as Record<string, unknown>).id).trim() !== "",
    )
    .map(normalizeDecision);
}

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

function normalizeDecision(d: unknown): Decision {
  const o = (d ?? {}) as Record<string, unknown>;
  const id = str(o.id);
  const label = str(o.label);
  const question = str(o.question);
  const recommended = str(o.recommended);
  const options = Array.isArray(o.options) ? o.options.map(str) : [];
  // Keep a non-empty chosen value as-is (it may be a free-text answer outside the
  // options); fall back to recommended only when chosen is missing/blank.
  const rawChosen = str(o.chosen);
  const chosen = rawChosen.trim() ? rawChosen : recommended;
  return { id, label, question, recommended, options, chosen };
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(str).map((s) => s.trim()).filter((s) => s !== "");
}

/** Tolerant terminology parse — missing/legacy plans degrade to empty lists. */
function normalizeTerminology(raw: unknown): Terminology {
  const o = (raw ?? {}) as Record<string, unknown>;
  const glossary = Array.isArray(o.glossary)
    ? o.glossary
        .map((g) => {
          const m = (g ?? {}) as Record<string, unknown>;
          return { term: str(m.term).trim(), meaning: str(m.meaning).trim() };
        })
        .filter((g) => g.term !== "")
    : [];
  return { entities: strArray(o.entities), roles: strArray(o.roles), glossary };
}

function normalizePlan(raw: unknown): Plan {
  const o = (raw ?? {}) as Record<string, unknown>;
  const outline: Record<string, string> = {};
  if (o.outline && typeof o.outline === "object") {
    for (const [k, v] of Object.entries(o.outline as Record<string, unknown>)) {
      outline[k] = str(v);
    }
  }
  return {
    category: str(o.category),
    industry: str(o.industry),
    scale: str(o.scale),
    platform: str(o.platform),
    decisions: normalizeDecisions(o.decisions),
    assumptions: Array.isArray(o.assumptions)
      ? o.assumptions.map((a) => {
          const m = (a ?? {}) as Record<string, unknown>;
          return { id: str(m.id), label: str(m.label), note: str(m.note) };
        })
      : [],
    terminology: normalizeTerminology(o.terminology),
    outline,
  };
}

/**
 * Tolerant JSON parser: strips ```json fences, tries `JSON.parse(raw)`, then the
 * first balanced `{ … }` span, and finally returns `minimalPlan()`.
 */
export function parsePlan(raw: string): Plan {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  for (const candidate of [stripped, extractJsonObject(stripped)]) {
    if (!candidate) continue;
    try {
      return normalizePlan(JSON.parse(candidate));
    } catch {
      // try next candidate
    }
  }
  return minimalPlan();
}

/**
 * Merge re-written decisions into a stored plan: keep the stored order, replace
 * each stored decision by the matching `next` id, then append new ids. Never
 * removes a stored decision.
 */
export function mergeDecisions(plan: Plan, next: Decision[]): Plan {
  const byId = new Map(next.map((d) => [d.id, d]));
  const decisions = plan.decisions.map((d) => byId.get(d.id) ?? d);
  const known = new Set(plan.decisions.map((d) => d.id));
  for (const d of next) if (!known.has(d.id)) decisions.push(d);
  return { ...plan, decisions };
}

/** Human/agent-readable rendering of the plan for prompts. */
export function planText(plan: Plan): string {
  const lines: string[] = [
    `Category: ${plan.category}`,
    `Industry: ${plan.industry}`,
    `Scale: ${plan.scale}`,
    `Platform: ${plan.platform}`,
  ];
  if (plan.decisions.length) {
    lines.push("", "Decisions:");
    for (const d of plan.decisions) {
      lines.push(
        `- ${d.label} — chosen: ${d.chosen} (recommended: ${d.recommended}; options: ${d.options.join(", ")})`,
      );
    }
  }
  if (plan.assumptions.length) {
    lines.push("", "Assumptions:");
    for (const a of plan.assumptions) lines.push(`- ${a.label}: ${a.note}`);
  }
  const { entities, roles, glossary } = plan.terminology;
  if (entities.length || roles.length || glossary.length) {
    lines.push(
      "",
      "Terminology (canonical names — reuse EXACTLY in every section, never a synonym):",
    );
    if (entities.length) lines.push(`- Entities: ${entities.join(", ")}`);
    if (roles.length) lines.push(`- Roles: ${roles.join(", ")}`);
    for (const g of glossary) lines.push(`- ${g.term}: ${g.meaning}`);
  }
  const outline = Object.entries(plan.outline);
  if (outline.length) {
    lines.push("", "Outline:");
    for (const [key, value] of outline) lines.push(`- ${key}: ${value}`);
  }
  return lines.join("\n");
}
