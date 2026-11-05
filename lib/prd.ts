import { PRD_SECTIONS, type SectionDef } from "./prompts.ts";
import type { Message } from "./db.ts";

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
export function conversationText(messages: Message[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
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
