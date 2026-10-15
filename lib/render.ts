import { PACK_ORDER, PACKS } from "./prompts.ts";
import type { PackId, PackDef, SectionDef } from "./prompts.ts";

export type SectionContent = { key: string; content_md: string };

/** Render one pack into a complete Markdown document. */
export function renderPack(packId: PackId, sections: SectionContent[], projectTitle: string): string {
  const pack: PackDef = PACKS[packId];
  const parts: string[] = [`# ${projectTitle} — ${pack.docTitle}`];
  for (const section of pack.sections) {
    parts.push(renderSection(section, sections));
  }
  return parts.join("\n\n") + "\n";
}

function renderSection(section: SectionDef, sections: SectionContent[]): string {
  const content = sections.find((s) => s.key === section.key)?.content_md.trim();
  const body = content || "_Belum diisi._";
  return `## ${section.title}\n\n${body}`;
}

/** Render all packs. Order: PRD first, then Design, then Brand. */
export function renderBundle(
  sections: SectionContent[],
  projectTitle: string,
): { file: string; content: string }[] {
  return [...PACK_ORDER].reverse().map((packId) => ({
    file: PACKS[packId].file,
    content: renderPack(packId, sections, projectTitle),
  }));
}
