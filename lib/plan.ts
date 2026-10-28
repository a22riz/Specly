export type PlanSection = { key: string; title: string; dependsOn: string[]; recommendation: string };
export type PlanResult = {
  nextSection: { key: string; title: string; reason: string } | null;
  suggestedOrder: PlanSection[];
  summary: string;
};

/**
 * Parse the AI's plan response. Strips code fences, JSON-parses, validates
 * shape (needs nextSection, suggestedOrder, summary). Returns null on
 * unparseable or shape-invalid output — never throws.
 */
export function parsePlanResponse(text: string): PlanResult | null {
  const cleaned = text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as PlanResult;
    if (!parsed || typeof parsed !== "object") return null;
    if (!("nextSection" in parsed) || !Array.isArray(parsed.suggestedOrder) || typeof parsed.summary !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
