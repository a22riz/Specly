import type { PackId, SectionDef } from "@/lib/prompts";

export type SectionRef = { packId: PackId; section: SectionDef };

/**
 * Return only sections that have no content (empty or whitespace-only).
 * Filled sections are skipped — never overwritten by Generate All.
 */
export function selectEmptySections(
  defs: SectionRef[],
  sectionsMap: Map<string, string>,
): SectionRef[] {
  return defs.filter((d) => !(sectionsMap.get(d.section.key) ?? "").trim());
}

/**
 * Encode an SSE record in the format the client parser expects.
 */
export function encodeSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
