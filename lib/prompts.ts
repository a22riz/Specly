export type PackId = "prd" | "design" | "brand" | "technical" | "delivery";

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
          "Write User Stories as 'As a <persona>, I want <goal>, so that <benefit>'. Give each story an ID (US-1, US-2...) and add Gherkin acceptance scenarios (Given/When/Then) under each story. While exploring, ask about edge cases in plain business language (e.g. 'what if stock runs out mid-checkout?') and capture the answers as extra scenarios — happy path alone is not done.",
      },
      {
        key: "prd.functional",
        title: "Kebutuhan Fungsional",
        enTitle: "Functional Requirements",
        hint: "Daftar kemampuan yang HARUS ada di aplikasi, bernomor (FR-1, FR-2, dst).",
        aiPrompt:
          "Write Functional Requirements as a numbered list with IDs (FR-1, FR-2...). Each requirement: one testable capability, no implementation detail. Trace each FR back to its user story ID. While exploring, ask what data the app must remember per entity (in plain language: 'what should the app remember about a customer?') and include a short 'Data to store' note per entity under the related FRs — field names stay business-language, the coding agent decides types.",
      },
      {
        key: "prd.examples",
        title: "Contoh Penggunaan",
        enTitle: "Example Inputs and Outputs",
        hint: "Contoh nyata data atau skenario per fitur utama, biar kebutuhannya tidak ambigu.",
        aiPrompt:
          "Write Example Inputs and Outputs: for each major feature, one concrete example — sample input data (JSON or plain table) and the expected output/result the user should see. Use realistic, product-specific values, never lorem-ipsum. This section doubles as a shared understanding check with the user.",
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
        title: "Batasan Teknis",
        enTitle: "Technical Constraints",
        hint: "Batas yang HARUS dipatuhi: teknologi yang dipakai/dilarang, tempat deploy, perangkat target.",
        aiPrompt:
          "Write Technical Constraints: required stack/environment, target devices/platforms, deployment constraints, forbidden tools or libraries, and integration limits (budget, offline, data residency). These are hard boundaries the coding agent must obey — keep each constraint explicit and absolute.",
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
        title: "Definisi Selesai",
        enTitle: "Definition of Done",
        hint: "Checklist: apa yang harus terpenuhi sebelum sebuah fitur dianggap selesai dikerjakan.",
        aiPrompt:
          "Write a Definition of Done checklist for coding agents: every item is verifiable before a feature counts as finished (acceptance scenarios pass, edge cases handled, tests exist for core logic, lint clean, accessibility basics checked). Adapt items to this product; no generic filler.",
      },
      {
        key: "prd.pitfalls",
        title: "Catatan & Jebakan",
        enTitle: "Known Pitfalls",
        hint: "Hal-hal yang pernah jadi masalah atau harus dihindari (opsional, isi kalau ada).",
        aiPrompt:
          "Write Known Pitfalls: gotchas, past problems, and things to avoid that surfaced in the conversation (confusing terms, tricky rules, common mistakes). Only include items actually grounded in what the user said — if there are none, write one line saying no known pitfalls.",
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
  technical: {
    id: "technical",
    name: "Technical Blueprint",
    description: "Spesifikasi teknis: arsitektur, data model, API, dan strategi testing.",
    file: "TECHNICAL.md",
    docTitle: "Technical Blueprint",
    sections: [
      {
        key: "technical.architecture",
        title: "Arsitektur Software",
        enTitle: "Software Architecture",
        hint: "Komponen sistem, hubungan antar komponen, dan aliran data.",
        aiPrompt:
          "Write the Software Architecture section based on the PRD and Design Pack. Describe the system architecture: major components, their responsibilities, how they connect, and the data flow between them. Use ### Component Overview, ### Data Flow, ### Technology Choices with justification grounded in the PRD constraints. Never invent frameworks or APIs the PRD does not mention — if a choice is open, say so and recommend with reasoning.",
      },
      {
        key: "technical.data_model",
        title: "Model Data & API",
        enTitle: "Data Model and API Specification",
        hint: "Tabel data, field, relasi, dan endpoint API yang dibutuhkan.",
        aiPrompt:
          "Write the Data Model & API Specification based on the PRD functional requirements and architecture. List data entities with their fields (business-language names — the coding agent decides types), relationships between entities, and API endpoints (method, path, request/response summary). Use ### Data Entities (as a table), ### Relationships, ### API Endpoints (as a table). Ground every entity and endpoint in a functional requirement — if a requirement needs data not listed here, add it.",
      },
      {
        key: "technical.nfr",
        title: "Kebutuhan Non-Fungsional Teknis",
        enTitle: "Non-Functional Requirements",
        hint: "Performa, keamanan, skalabilitas, dan keterbatasan teknis.",
        aiPrompt:
          "Write technical Non-Functional Requirements as a numbered list with IDs (T-NFR-1, T-NFR-2...). Cover performance targets, security measures, scalability, observability, and data integrity. Measurable where possible (response time targets, rate limits, backup frequency). Do not repeat business-level NFRs from the PRD — focus on technical depth.",
      },
      {
        key: "technical.test_strategy",
        title: "Strategi Testing",
        enTitle: "Test Strategy and Acceptance Criteria",
        hint: "Jenis test, lingkup, dan kriteria terima per fitur.",
        aiPrompt:
          "Write the Test Strategy & Acceptance Criteria based on the PRD user stories and functional requirements. Cover: test layers (unit, integration, e2e), what each layer covers, acceptance criteria per user story (reference US IDs), edge cases to test, and manual verification steps. Use ### Test Layers, ### Acceptance Criteria (table with US ID, scenario, expected result), ### Edge Cases.",
      },
    ],
  },
  delivery: {
    id: "delivery",
    name: "Delivery Plan",
    description: "Rencana implementasi bertahap dan definisi selesai.",
    file: "DELIVERY.md",
    docTitle: "Delivery Plan",
    sections: [
      {
        key: "delivery.plan",
        title: "Rencana Implementasi",
        enTitle: "Implementation Plan",
        hint: "Fase implementasi, urutan tugas, dan dependensi antar fase.",
        aiPrompt:
          "Write the Implementation Plan based on ALL prior sections (PRD, Brand, Design, Technical). Break the work into phases (Phase 1, Phase 2, etc.), each phase delivering a vertical slice of user value. For each phase: list the tasks, which functional requirements (FR IDs) and user stories (US IDs) it delivers, and dependencies on prior phases. Order phases so each builds on the previous. Use ### Phase N: <name> headings with bullet lists of tasks, then a ### Dependencies subsection. Include a text-based dependency summary at the end.",
      },
      {
        key: "delivery.dod",
        title: "Definisi Selesai",
        enTitle: "Definition of Done",
        hint: "Checklist verifikasi sebelum fitur dianggap selesai.",
        aiPrompt:
          "Write a Definition of Done checklist for coding agents working on this project. Every item must be verifiable before a feature counts as finished. Cover: acceptance scenarios pass, edge cases handled, tests exist for core logic, lint and typecheck clean, accessibility basics checked, documentation updated. Adapt items to this specific product based on the PRD and technical sections — no generic filler. Use a bullet checklist.",
      },
    ],
  },
};

export const PACK_ORDER: PackId[] = ["prd", "brand", "design", "technical", "delivery"];

/** Special section (raw SVG) stored like a section but excluded from MD packs. */
export const LOGO_KEY = "brand.logo";

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
  mode: "suggest" | "refine" | "generate",
  projectTitle: string,
  contextMd: string,
): string {
  const packDef = PACKS[pack];
  const interview =
    mode === "suggest"
      ? `The user is exploring this section. Ask the user up to 2 short questions in Indonesian at a time to fill gaps, one conversational turn at a time. When you have enough material (or the user asks for it), output the drafted section — in that reply, ALWAYS include exactly one <content> block containing the final section in English.`
      : mode === "refine"
        ? `The user wrote a draft or notes. Rewrite it into the polished section content in English. Briefly explain in Indonesian what you improved before the content.`
        : `Write the complete section now based on the idea and context provided. Do not ask questions. Output exactly one <content> block with the final section content in English.`;

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
    contextMd ? `Context from this project's documents:\n${contextMd}` : `Context: none yet.`,
  ].join("\n");
}

/** Compact context of already-written sections, for AI grounding. */
export function buildContext(
  pack: PackId,
  sections: { key: string; content_md: string }[],
  extraPacks: PackId[] = [],
): string {
  const render = (p: PackId) =>
    PACKS[p].sections
      .map((s) => {
        const found = sections.find((x) => x.key === s.key);
        return found?.content_md.trim() ? `## ${s.title}\n${found.content_md.trim()}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  const own = render(pack);
  const upstream = extraPacks
    .map((p) => render(p))
    .filter(Boolean)
    .map((md, i) => `### From ${PACKS[extraPacks[i]].file}\n${md}`)
    .join("\n\n");
  return [own, upstream].filter(Boolean).join("\n\n");
}

export function buildValidationPrompt(contextMd: string): string {
  return [
    `You are a blueprint consistency validator. Read the complete project documentation below and check for:`,
    `1. Requirements (FR IDs) without corresponding test cases or acceptance criteria.`,
    `2. Contradictions between sections (e.g., PRD says X, Technical says not-X).`,
    `3. Features mentioned in one document but not specified in the relevant section.`,
    `4. User stories (US IDs) without functional requirements covering them.`,
    `5. Missing information: sections that are too vague to implement.`,
    ``,
    `Return a JSON array of findings. Each finding:`,
    `{"severity":"error|warning|info","section":"<section key>","message":"<what is wrong>","suggestion":"<how to fix>"}`,
    ``,
    `If no issues found, return an empty array: []`,
    ``,
    `Documentation:`,
    contextMd,
  ].join("\n");
}

/** SVG output rules shared by fresh generation and feedback-based revision. */
const LOGO_SVG_RULES = [
  `- SVG requirements: viewBox="0 0 256 256", flat vector shapes, no external images/fonts/scripts, no CSS animations, at most 3 colors (prefer hex from the brand palette if available), legible at 32px.`,
  `- If the logo includes the brand name, render it with generic font-family values (e.g. "sans-serif") and keep it short.`,
].join("\n");

/** Revision prompt — the user gives feedback on the current SVG. */
export function buildLogoRevisePrompt(
  projectTitle: string,
  projectContextMd: string,
  currentSvg: string,
  feedback: string,
): string {
  return [
    `You are a senior logo designer. Revise the existing SVG logo for the project "${projectTitle}" based on the user's feedback.`,
    projectContextMd
      ? `Project context gathered during exploration (brand identity, PRD, design pack) to follow:\n${projectContextMd}`
      : `No documents yet; use a clean, neutral, professional direction.`,
    ``,
    `Current logo SVG:\n${currentSvg}`,
    ``,
    `User feedback (in Indonesian): ${feedback}`,
    ``,
    `Output rules:`,
    `- One short Indonesian sentence about what you changed (outside <content>).`,
    `- Then exactly one <content> block containing ONLY the complete revised SVG: a single self-contained <svg> element.`,
    `- Keep what already works; change only what the feedback asks for.`,
    LOGO_SVG_RULES,
  ].join("\n");
}

/** Logo generation prompt — the LLM writes SVG directly, no image API needed. */
export function buildLogoPrompt(projectTitle: string, projectContextMd: string, extraDirection?: string): string {
  return [
    `You are a senior logo designer. Design a logo for the project "${projectTitle}".`,
    projectContextMd
      ? `Project context gathered during exploration (brand identity, PRD, design pack) to follow:\n${projectContextMd}`
      : `No documents yet; use a clean, neutral, professional direction.`,
    extraDirection ? `Additional direction from the user (in Indonesian, follow it): ${extraDirection}` : "",
    ``,
    `Output rules:`,
    `- One short Indonesian sentence about your concept (outside <content>).`,
    `- Then exactly one <content> block containing ONLY the raw SVG: a single self-contained <svg> element.`,
    LOGO_SVG_RULES,
  ].join("\n");
}
