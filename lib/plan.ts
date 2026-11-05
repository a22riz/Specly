export type Decision = {
  id: string;
  label: string;
  question: string;
  recommended: string;
  options: string[];
  chosen: string;
};

export type Assumption = { id: string; label: string; note: string };

export type Plan = {
  category: string;
  industry: string;
  scale: string;
  platform: string;
  decisions: Decision[];
  assumptions: Assumption[];
  outline: Record<string, string>;
};

/** Empty plan used when nothing parseable is available. */
export function minimalPlan(): Plan {
  return {
    category: "",
    industry: "",
    scale: "",
    platform: "",
    decisions: [],
    assumptions: [],
    outline: {},
  };
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
  let chosen = str(o.chosen);
  // Force chosen into options; fall back to the recommended value.
  if (!options.includes(chosen)) chosen = recommended;
  return { id, label, question, recommended, options, chosen };
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
    decisions: Array.isArray(o.decisions) ? o.decisions.map(normalizeDecision) : [],
    assumptions: Array.isArray(o.assumptions)
      ? o.assumptions.map((a) => {
          const m = (a ?? {}) as Record<string, unknown>;
          return { id: str(m.id), label: str(m.label), note: str(m.note) };
        })
      : [],
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
      lines.push(`- ${d.label} — recommended: ${d.recommended} (options: ${d.options.join(", ")})`);
    }
  }
  if (plan.assumptions.length) {
    lines.push("", "Assumptions:");
    for (const a of plan.assumptions) lines.push(`- ${a.label}: ${a.note}`);
  }
  const outline = Object.entries(plan.outline);
  if (outline.length) {
    lines.push("", "Outline:");
    for (const [key, value] of outline) lines.push(`- ${key}: ${value}`);
  }
  return lines.join("\n");
}
