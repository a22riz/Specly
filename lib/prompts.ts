export type PackId = "prd";

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

/** The 12 PRD sections, in authoring order. Single source of truth. */
export const PRD_SECTIONS: SectionDef[] = [
  {
    key: "prd.overview",
    title: "Ringkasan Masalah",
    enTitle: "Overview",
    hint: "Masalah yang mau diselesaikan, siapa penggunanya, dan kenapa ini penting sekarang.",
    aiPrompt:
      "Write the Overview section: the problem statement, who has the problem (target users/stakeholders), and why it matters now. Structure with ### Problem, ### Users, ### Why Now. Ground every claim in what the user said — no invented context.",
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
      "Write User Stories as 'As a <persona>, I want <goal>, so that <benefit>'. Give each story an ID (US-1, US-2...) and add Gherkin acceptance scenarios (Given/When/Then) under each story. Ask about edge cases in plain business language and capture the answers as extra scenarios — happy path alone is not done.",
  },
  {
    key: "prd.acceptance",
    title: "Skenario Penerimaan",
    enTitle: "Acceptance Scenarios",
    hint: "Skenario uji terperinci per fitur: kondisi awal, aksi, dan hasil yang diharapkan.",
    aiPrompt:
      "Write Acceptance Scenarios as a numbered list with IDs (AS-1, AS-2...) in Gherkin form (Given/When/Then). Each scenario is concrete and testable, references the user story (US ID) it verifies, and covers the happy path plus at least one failure or edge path. No implementation detail.",
  },
  {
    key: "prd.functional",
    title: "Kebutuhan Fungsional",
    enTitle: "Functional Requirements",
    hint: "Daftar kemampuan yang HARUS ada di aplikasi, bernomor (FR-1, FR-2, dst).",
    aiPrompt:
      "Write Functional Requirements as a numbered list with IDs (FR-1, FR-2...). Each requirement: one testable capability, no implementation detail. Trace each FR back to its user story ID (US ID). Include a short 'Data to store' note per entity under the related FRs — field names stay business-language, the coding agent decides types.",
  },
  {
    key: "prd.entities",
    title: "Entitas Utama",
    enTitle: "Key Entities",
    hint: "Hal penting yang harus diingat aplikasi (mis. pelanggan, pesanan) dan info apa saja per entitas.",
    aiPrompt:
      "Write Key Entities: the core things the app must remember, each with the business-language attributes it holds and its relationships to other entities. Present as a table (Entity | Attributes | Relationships). Use only entities that surfaced in the conversation; field names stay business-language, the coding agent decides types.",
  },
  {
    key: "prd.edgecases",
    title: "Kasus Khusus",
    enTitle: "Edge Cases",
    hint: "Situasi tak biasa yang harus ditangani: data kosong, gagal, batas maksimal.",
    aiPrompt:
      "Write Edge Cases: unusual or boundary situations the product must handle — empty data, invalid input, failures, limits, concurrent actions, offline. Each item states the situation and the expected behavior. Only include cases grounded in the conversation or clearly implied by the requirements; mark genuine unknowns explicitly.",
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
    key: "prd.constraints",
    title: "Batasan & Asumsi",
    enTitle: "Constraints and Assumptions",
    hint: "Batas yang HARUS dipatuhi (teknologi, tempat deploy, perangkat target) dan hal yang dianggap benar.",
    aiPrompt:
      "Write Constraints and Assumptions. Constraints: hard boundaries — required stack/environment, target devices/platforms, deployment limits, forbidden tools, budget/offline/data-residency limits — each explicit and absolute. Assumptions: things taken as true that would change the plan if wrong. Structure with ### Constraints and ### Assumptions.",
  },
  {
    key: "prd.glossary",
    title: "Glosarium",
    enTitle: "Glossary",
    hint: "Istilah khusus yang dipakai di dokumen ini beserta artinya, biar tidak salah tafsir.",
    aiPrompt:
      "Write a Glossary: domain terms used in this PRD with a one-line plain-language definition each. Present as a table (Term | Meaning). Include only terms that actually appear in the conversation; skip generic words.",
  },
  {
    key: "prd.success",
    title: "Kriteria Keberhasilan",
    enTitle: "Success Criteria",
    hint: "Bagaimana tahu produk ini berhasil? Ukuran yang jelas dan bisa diukur.",
    aiPrompt:
      "Write Success Criteria: measurable, technology-agnostic outcomes (metrics, baselines, targets) that validate the product delivered its goals.",
  },
  {
    key: "prd.dod",
    title: "Definisi Selesai & Urutan Build",
    enTitle: "Definition of Done and Build Order",
    hint: "Checklist sebelum fitur dianggap selesai, plus urutan pengerjaan yang disarankan.",
    aiPrompt:
      "Write Definition of Done and Build Order. First a DoD checklist for coding agents — every item verifiable before a feature counts as finished (acceptance scenarios pass, edge cases handled, tests exist for core logic, lint/typecheck clean, accessibility basics checked), adapted to this product, no generic filler. Then a ### Build Order: ordered phases (Phase 1, Phase 2...) each delivering a vertical slice, listing the FR/US IDs it delivers and its dependencies on prior phases.",
  },
];

export const PACKS: Record<PackId, PackDef> = {
  prd: {
    id: "prd",
    name: "PRD",
    description: "Kebutuhan produk: apa yang dibutuhkan user dan kenapa.",
    file: "PRD.md",
    docTitle: "Product Requirements Document",
    sections: PRD_SECTIONS,
  },
};

export const PACK_ORDER: PackId[] = ["prd"];

/**
 * Explore prompt — the gather + clarify phase. The agent talks with the user in
 * Indonesian, asks plain-language questions, and NEVER writes document content.
 */
export function buildExplorePrompt(projectTitle: string, prdContextMd: string): string {
  return [
    `You are a product-discovery partner helping a NON-TECHNICAL user think through the project "${projectTitle}".`,
    `Your job in this phase is to EXPLORE, not to write the document.`,
    ``,
    `Rules:`,
    `- Talk WITH the user in Indonesian (simple language, no jargon).`,
    `- Ask a few short questions at a time, one conversational turn at a time. Wait for answers before moving on.`,
    `- Ask in plain business language (e.g. "kalau stok habis pas checkout, harus gimana?"), never in technical terms.`,
    `- Cover, over the conversation: the problem and who has it, goals and non-goals, user stories, requirements, what data the app must remember, edge cases, constraints, key terms (glossary), and what success looks like.`,
    `- Probe for edge cases and unknowns; the happy path alone is not enough.`,
    `- Do NOT write document content. Never emit a content block or any document markup — no headings, no specs, no markdown documents. Only conversation.`,
    `- Never invent facts about the product; if something is unknown, ask.`,
    `- Summarize your understanding back in Indonesian when helpful, but always as conversation, never as a document.`,
    ``,
    prdContextMd
      ? `Context from this project's documents (already written, for consistency):\n${prdContextMd}`
      : `Context: none yet — this is the start of the conversation.`,
  ].join("\n");
}

/**
 * Write prompt — drafts ONE PRD section as English markdown inside a single
 * <content> block, grounded in the conversation. Unknowns become
 * [NEEDS CLARIFICATION: ...] instead of invented facts.
 */
export function buildWriteSectionPrompt(
  section: SectionDef,
  projectTitle: string,
  prdContextMd: string,
  conversationText: string,
): string {
  return [
    `You are a product-requirements assistant writing ONE section of the PRD for the project "${projectTitle}".`,
    `You are writing the section "${section.title}" (document heading: "${section.enTitle}").`,
    ``,
    `Rules:`,
    `- Use the conversation below as the only source of truth. Do not ask questions in this phase — write now.`,
    `- ALL document content inside <content> tags is written in ENGLISH — headings, user stories, requirements, tables, everything. The user's Indonesian replies are input only; translate them into English inside <content>.`,
    `- Only exception: exact product UI strings the user quotes (e.g. error messages like "Nama pelanggan wajib diisi") stay verbatim.`,
    `- Never invent implementation details (frameworks, APIs, code) in content.`,
    `- Never invent facts the user did not provide. If the conversation is missing something this section needs, write [NEEDS CLARIFICATION: <what is missing, in English>] at that spot instead of guessing.`,
    `- Use the already-written sections (below) as context; stay consistent with them.`,
    `- Section instruction: ${section.aiPrompt}`,
    `- If your content starts with a heading, use exactly "### ${section.enTitle}" — never translate or rename it.`,
    ``,
    `Output format (exactly one <content> block):`,
    `<content>...markdown for this section...</content>`,
    `Any short note to the user goes outside the <content> block.`,
    ``,
    prdContextMd ? `Already-written sections:\n${prdContextMd}` : `Already-written sections: none yet.`,
    ``,
    `Conversation with the user:`,
    conversationText,
  ].join("\n");
}

/** Render all 12 PRD sections (filled AND empty) for grounding the agent. */
export function buildPrdContext(sections: { key: string; content_md: string }[]): string {
  return PRD_SECTIONS.map((s) => {
    const found = sections.find((x) => x.key === s.key);
    return found?.content_md.trim()
      ? `## ${s.title}\n${found.content_md.trim()}`
      : `## ${s.title}\n_Belum diisi._`;
  }).join("\n\n");
}
