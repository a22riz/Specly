import { PRD_SECTIONS, type SectionDef } from "./prompts.ts";
import { parseDiscoveryTurn } from "./discovery.ts";

/** The assistant's single `<content>…</content>` body (fences stripped), or null. */
export function extractContent(text: string): string | null {
  const match = text.match(/<content>([\s\S]*?)<\/content>/);
  const content = match?.[1]
    ?.trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  return content || null;
}

/** Transcript for the write prompt: user text is quoted verbatim, never parsed. */
export function conversationText(messages: { role: string; content: string }[]): string {
  return messages
    .map((m) => {
      if (m.role !== "assistant") return `${m.role}: ${m.content}`;
      const turn = parseDiscoveryTurn(m.content);
      if (!turn.say && !turn.question) return `assistant: ${m.content}`;
      const lines = [`assistant: ${turn.say}`];
      if (turn.question) {
        lines.push(`Pertanyaan: ${turn.question.text}`);
        lines.push(`Opsi: ${turn.question.options.join(" | ")}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function hasAnyContent(existing: { key: string; content_md: string }[]): boolean {
  return existing.some((s) => s.content_md.trim());
}

/** Sections to write, in PRD order: empty-only by default, all 12 when forced. */
export function sectionsToWrite(
  existing: { key: string; content_md: string }[],
  force = false,
): SectionDef[] {
  if (force) return [...PRD_SECTIONS];
  const filled = new Set(existing.filter((s) => s.content_md.trim()).map((s) => s.key));
  return PRD_SECTIONS.filter((s) => !filled.has(s.key));
}

/** Project title from a free-text description: first non-empty line, trimmed, capped at 60. */
export function deriveTitle(description: string): string {
  const line = description
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line ?? "").slice(0, 60);
}

/** Auto-draft a PRD on first visit: AI ready, nothing written, not already started, discovery done. */
export function shouldAutoRun(
  hasContent: boolean,
  aiReady: boolean,
  alreadyStarted: boolean,
  discoveryDone = false,
): boolean {
  return aiReady && !hasContent && !alreadyStarted && discoveryDone;
}
