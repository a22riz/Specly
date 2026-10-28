export type Finding = {
  severity: "error" | "warning" | "info";
  section: string;
  message: string;
  suggestion: string;
};

/**
 * Parse the AI's validation response into a findings array.
 * Strips markdown code fences, then JSON-parses. Returns [] on
 * unparseable output or non-array JSON — never throws.
 */
export function parseValidationResponse(text: string): Finding[] {
  const cleaned = text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? (parsed as Finding[]) : [];
  } catch {
    return [];
  }
}
