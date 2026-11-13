export type DiscoveryTurn = {
  say: string;
  question: { text: string; options: string[] } | null;
  done: boolean;
};

/** Hard cap on discovery questions asked before drafting the PRD. */
export const DISCOVERY_MAX = 8;

/**
 * Floor on discovery questions. The model tends to declare "done" after a single
 * answer, which starves the draft of context; below this many questions the route
 * bounces an early `done` back and asks for one more.
 */
export const DISCOVERY_MIN = 4;

export function canAskMore(asked: number, max: number = DISCOVERY_MAX): boolean {
  return asked < max;
}

/**
 * True when the model wants to finish but has not asked enough to draft a solid
 * PRD. The route uses this as a backstop so the floor holds even if the prompt is
 * ignored.
 */
export function needsMoreDiscovery(turn: DiscoveryTurn, asked: number): boolean {
  return turn.done && asked < DISCOVERY_MIN;
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

function normalizeQuestion(v: unknown): DiscoveryTurn["question"] {
  const o = (v ?? {}) as Record<string, unknown>;
  if (typeof o.text !== "string") return null;
  const options = Array.isArray(o.options)
    ? o.options.filter((x): x is string => typeof x === "string")
    : [];
  if (!options.length) return null;
  return { text: o.text, options };
}

function normalizeTurn(v: unknown): DiscoveryTurn {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    say: typeof o.say === "string" ? o.say : "",
    question: normalizeQuestion(o.question),
    done: o.done === true,
  };
}

/**
 * Tolerant JSON parser: strips ```json fences, tries `JSON.parse`, then the
 * first balanced `{ … }` span. Never throws — a prose reply degrades to
 * `{ say: raw, question: null, done: false }`.
 */
export function parseDiscoveryTurn(raw: string): DiscoveryTurn {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  for (const candidate of [stripped, extractJsonObject(stripped)]) {
    if (!candidate) continue;
    try {
      return normalizeTurn(JSON.parse(candidate));
    } catch {
      // try next candidate
    }
  }
  return { say: raw.trim(), question: null, done: false };
}
