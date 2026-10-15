export type PackId = "prd" | "design" | "brand";

export type SectionDef = {
  key: string;
  /** Indonesian label, shown in the editor UI. */
  title: string;
  /** English heading used in the exported document and by the AI. */
  enTitle: string;
  /** Short guidance shown to the non-IT user in the editor. */
  hint: string;
  /** Instruction the AI uses when drafting/refining this section. */
  aiPrompt: string;
};

export type PackDef = {
  id: PackId;
  name: string;
  description: string;
  /** Doc filename on export. */
  file: string;
  /** Doc heading on export. */
  docTitle: string;
  sections: SectionDef[];
};

export const PACKS: Record<PackId, PackDef> = {
  prd: {
    id: "prd",
    name: "PRD",
    description: "Kebutuhan produk: apa yang dibutuhkan user dan kenapa.",
    file: "PRD.md",
    docTitle: "Product Requirements Document",
    sections: [
      {
        key: "prd.introduction",
        title: "Pendahuluan",
        enTitle: "Introduction",
        hint: "Masalah yang mau diselesaikan, siapa saja yang terlibat, dan istilah penting.",
        aiPrompt:
          "Write the Introduction section: the problem statement, target users/stakeholders, and a short glossary of domain terms the user mentioned. Structure with ### Problem, ### Stakeholders, ### Glossary.",
      },
      {
        key: "prd.goals",
        title: "Tujuan & Non-Tujuan",
        enTitle: "Goals and Non-Goals",
        hint: "Apa yang ingin dicapai, dan apa yang sengaja TIDAK dikerjakan sekarang.",
        aiPrompt:
          "Write Goals and Non-Goals. Goals: product objectives phrased as outcomes. Non-Goals: explicitly out-of-scope items. Structure with ### Goals and ### Non-Goals bullet lists.",
      },
      {
        key: "prd.stories",
        title: "Cerita Pengguna",
        enTitle: "User Stories",
        hint: "Skenario penggunaan dari sudut pandang user: sebagai [peran], saya ingin [tujuan], sehingga [manfaat].",
        aiPrompt:
          "Write User Stories as 'As a <persona>, I want <goal>, so that <benefit>'. Give each story an ID (US-1, US-2...) and add Gherkin acceptance scenarios (Given/When/Then) under each story.",
      },
      {
        key: "prd.functional",
        title: "Kebutuhan Fungsional",
        enTitle: "Functional Requirements",
        hint: "Daftar kemampuan yang HARUS ada di aplikasi, bernomor (FR-1, FR-2, dst).",
        aiPrompt:
          "Write Functional Requirements as a numbered list with IDs (FR-1, FR-2...). Each requirement: one testable capability, no implementation detail. Trace each FR back to its user story ID.",
      },
      {
        key: "prd.nonfunctional",
        title: "Kebutuhan Non-Fungsional",
        enTitle: "Non-Functional Requirements",
        hint: "Persyaratan kualitas: performa, keamanan, aksesibilitas, kompatibilitas.",
        aiPrompt:
          "Write Non-Functional Requirements as a numbered list with IDs (NFR-1, NFR-2...). Cover performance, security/privacy, accessibility, and platform/browser support. Measurable where possible.",
      },
      {
        key: "prd.success",
        title: "Kriteria Keberhasilan",
        enTitle: "Success Criteria",
        hint: "Bagaimana tahu produk ini berhasil? Ukuran yang jelas dan bisa diukur.",
        aiPrompt:
          "Write Success Criteria: measurable, technology-agnostic outcomes (metrics, baselines, targets) that validate the product delivered its goals.",
      },
    ],
  },
  design: {
    id: "design",
    name: "Design Pack",
    description: "Spesifikasi tampilan: komponen, layout, dan aturan desain.",
    file: "DESIGN_PACK.md",
    docTitle: "Design Pack",
    sections: [
      {
        key: "design.tokens",
        title: "Token Desain",
        enTitle: "Design Tokens",
        hint: "Warna, ukuran huruf, dan jarak antar elemen.",
        aiPrompt:
          "Write Design Tokens derived from the Brand Pack (voice, visual identity): color palette (semantic roles with hex values), type scale, spacing scale, radius, shadows. Present as a table.",
      },
      {
        key: "design.components",
        title: "Komponen & Layout",
        enTitle: "Components and Layout",
        hint: "Elemen UI yang dibutuhkan (tombol, form, kartu, dll) dan susunan halamannya.",
        aiPrompt:
          "Write Components & Layout: the page inventory, a layout description per page (structure, not code), and a component inventory (buttons, forms, cards, tables...) with behavioral notes.",
      },
      {
        key: "design.flows",
        title: "Alur & Kondisi UI",
        enTitle: "UI Flows and States",
        hint: "Perjalanan user antar halaman, plus tampilan saat kosong/proses/gagal.",
        aiPrompt:
          "Write UI Flows & States: step-by-step user journeys for each key flow, plus empty/loading/error/success states for data-driven screens.",
      },
      {
        key: "design.a11y",
        title: "Aksesibilitas",
        enTitle: "Accessibility",
        hint: "Aturan agar aplikasi nyaman dipakai semua orang (kontras, keyboard, screen reader).",
        aiPrompt:
          "Write Accessibility requirements: contrast minimums, keyboard navigation, focus visibility, screen reader expectations, reduced motion.",
      },
    ],
  },
  brand: {
    id: "brand",
    name: "Brand Pack",
    description: "Identitas merek: kepribadian, pesan, dan arah visual.",
    file: "BRAND_PACK.md",
    docTitle: "Brand Pack",
    sections: [
      {
        key: "brand.voice",
        title: "Nada Bicara",
        enTitle: "Voice and Tone",
        hint: "Kepribadian merek kalau 'dia bicara': ramah? formal? santai?",
        aiPrompt:
          "Write Voice & Tone: brand personality, tone per context (onboarding, errors, empty states), and example phrases in Indonesian and English.",
      },
      {
        key: "brand.messaging",
        title: "Pesan Utama",
        enTitle: "Messaging Framework",
        hint: "Positioning, tagline, dan pesan kunci ke pengguna.",
        aiPrompt:
          "Write Messaging Framework: positioning statement, tagline candidates, key message pillars. Keep the user's product in mind.",
      },
      {
        key: "brand.visual",
        title: "Identitas Visual",
        enTitle: "Visual Identity",
        hint: "Arah visual: gaya warna, suasana, inspirasi logo.",
        aiPrompt:
          "Write Visual Identity direction: overall style, color mood, typography character, logo direction, imagery style. Descriptive direction only, no final assets.",
      },
      {
        key: "brand.rules",
        title: "Do & Don't",
        enTitle: "Do and Don't",
        hint: "Boleh dan jangan: aturan penggunaan identitas dan bahasa.",
        aiPrompt:
          "Write Do/Don't rules: what the brand language and visuals must and must never do. Two bullet lists.",
      },
    ],
  },
};

export const PACK_ORDER: PackId[] = ["brand", "design", "prd"];

export function findSection(pack: PackId, key: string): SectionDef | undefined {
  return PACKS[pack].sections.find((s) => s.key === key);
}

/**
 * System prompt for the AI. Conversation with the user is in Indonesian;
 * document content is in English so coding agents parse it best.
 */
export function buildSystemPrompt(
  pack: PackId,
  section: SectionDef,
  mode: "suggest" | "refine",
  projectTitle: string,
  contextMd: string,
): string {
  const packDef = PACKS[pack];
  const interview =
    mode === "suggest"
      ? `The user is exploring this section. Ask the user up to 2 short questions in Indonesian at a time to fill gaps, one conversational turn at a time. When you have enough material (or the user asks for it), output the drafted section — in that reply, ALWAYS include exactly one <content> block containing the final section in English.`
      : `The user wrote a draft or notes. Rewrite it into the polished section content in English. Briefly explain in Indonesian what you improved before the content.`;

  return [
    `You are a product-requirements assistant helping a NON-TECHNICAL user write documentation for the project "${projectTitle}".`,
    `You are working on the "${packDef.name}" pack, section "${section.title}" (document heading: "${section.enTitle}").`,
    ``,
    `Rules:`,
    `- Talk WITH the user in Indonesian (simple language, no jargon).`,
    `- IMPORTANT: ALL document content inside <content> tags is written in ENGLISH — headings, user stories, requirements, tables, everything. The user's Indonesian replies are input only; translate them into English inside <content>.`,
    `- Only exception: exact product UI strings the user quotes (e.g. error messages like "Nama pelanggan wajib diisi") stay verbatim.`,
    `- Never invent technical implementation details (frameworks, APIs, code) in content.`,
    `- Use the sections already written (below) as context; stay consistent with them.`,
    `- Section instruction: ${section.aiPrompt}`,
    `- If your content starts with a heading, use exactly "### ${section.enTitle}" — never translate or rename it.`,
    ``,
    `Task for this turn: ${interview}`,
    ``,
    `Output format when drafting content (exactly one <content> block):`,
    `<content>...markdown for this section...</content>`,
    `Any explanation or questions to the user go outside the <content> block.`,
    ``,
    contextMd ? `Context from the same document:\n${contextMd}` : `Context: none yet.`,
  ].join("\n");
}

/** Compact context of already-written sections, for AI grounding. */
export function buildContext(pack: PackId, sections: { key: string; content_md: string }[]): string {
  const packDef = PACKS[pack];
  return packDef.sections
    .map((s) => {
      const found = sections.find((x) => x.key === s.key);
      return found?.content_md.trim() ? `## ${s.title}\n${found.content_md.trim()}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}
