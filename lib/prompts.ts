import { planText, type Plan } from "./plan.ts";

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
      "Write Key Entities: the core things the app must remember, each with the business-language attributes it holds and its relationships to other entities. Present as a table (Entity | Attributes | Relationships). Include the entities this app category normally needs (see the App Playbook) even if the user did not name them, marking inferred ones [ASSUMPTION: ...]. Field names stay business-language, the coding agent decides types.",
  },
  {
    key: "prd.edgecases",
    title: "Kasus Khusus",
    enTitle: "Edge Cases",
    hint: "Situasi tak biasa yang harus ditangani: data kosong, gagal, batas maksimal.",
    aiPrompt:
      "Write Edge Cases: unusual or boundary situations the product must handle — empty data, invalid input, failures, limits, concurrent actions, offline. Each item states the situation and the expected behavior. Include the edge cases this app category commonly needs (see the App Playbook), marking inferred ones [ASSUMPTION: ...].",
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
 * Category playbook the explore + write agents reason from. Lets the AI
 * recognize the kind of app and inherit its typical users, entities, must-have
 * features, edge cases, and industry concerns — so it can PROPOSE defaults
 * instead of interrogating a non-technical user.
 */
export const APP_PLAYBOOK = [
  `Recognize the category and inherit its defaults. Each line: category — typical users; core entities; must-have features; edge cases; industry concerns.`,
  ``,
  `- Toko online / e-commerce — pembeli, admin; Produk, Kategori, Keranjang, Pesanan, Pembayaran, Pengiriman; katalog, cari, checkout, ongkir, status pesanan; stok habis saat checkout, pembayaran gagal, pesanan ganda, retur; pajak, ongkos kirim per wilayah, kurir, notifikasi WA/email, bukti bayar.`,
  `- Marketplace / multi-penjual — pembeli, penjual, kurir, admin; Toko, Produk, Pesanan, Komisi, Payout, Sengketa; onboarding penjual, split pembayaran, ulasan; penipuan, sengketa, penarikan dana; verifikasi penjual, KYC, perpajakan.`,
  `- POS / kasir (toko, warung, restoran) — kasir, pemilik, dapur/barista; Produk, Stok, Transaksi, Shift, Meja; pilih/scan produk, hitung total, cetak struk, tutup shift; stok minus, pembulatan, diskon, refund, offline; pajak/service charge, printer struk, multi-outlet, mode offline.`,
  `- Pemesanan/reservasi (restoran, klinik, salon, hotel, tiket) — pelanggan, staf, admin; Layanan, Jadwal/Slot, Reservasi, Pembayaran/DP; pilih slot, konfirmasi, reschedule, batal; slot bentrok, no-show, kuota penuh, bayar terlambat; jam operasional, kebijakan DP/refund, reminder, zona waktu.`,
  `- CRM / penjualan — sales, manajer, admin; Kontak, Perusahaan, Deal, Aktivitas, Pipeline; catat lead, pipeline, follow-up, laporan; duplikat kontak, deal macet, kepemilikan; impor data, privasi (UU PDP), integrasi email/WA.`,
  `- Manajemen proyek/tugas — anggota tim, manajer; Proyek, Tugas, Anggota, Komentar, Label, Tenggat; buat tugas, assign, papan kanban, tenggat, notifikasi; tugas telat, beban kerja, konflik jadwal; zona waktu, izin akses, audit log.`,
  `- Keuangan pribadi / pembukuan / invoice — pemilik, akuntan; Transaksi, Kategori, Akun, Invoice, Pelanggan; catat pemasukan/pengeluaran, kategori, laporan, invoice; transaksi ganda, kurs, uang muka; mata uang, pajak (PPN), format angka, ekspor CSV.`,
  `- Pendidikan / LMS / kursus — siswa, guru, admin; Kursus, Materi, Kelas, Pendaftaran, Progres, Kuis; katalog kursus, enrol, materi, kuis, sertifikat; akses kedaluwarsa, progres hilang, pengerjaan bersamaan; hak cipta konten, anti-curang, aksesibilitas video.`,
  `- Kesehatan / klinik — pasien, dokter, resepsionis, admin; Pasien, Jadwal, Rekam Medis, Resep, Kunjungan; daftar pasien, janji temu, catatan medis, resep; pasien ganda, alergi, kerahasiaan; privasi data kesehatan (ketat), izin praktik, audit akses.`,
  `- Logistik / pengiriman / armada — pengirim, kurir, penerima, admin; Pengiriman, Rute, Armada, Kurir, Bukti Terima, Tarif; input order, assign kurir, lacak status, bukti terima (POD); alamat salah, gagal antar, COD, retur; tarif per zona/berat, biaya BBM, SLA, zona waktu.`,
  `- Sosial / komunitas / forum — pengguna, moderator, admin; Pengguna, Posting, Komentar, Like, Laporan, Moderasi; posting, komentar, ikuti, feed, moderasi; spam, konten kasar, akun ganda, laporan; moderasi, privasi, ekspor data, notifikasi.`,
  `- Konten / blog / media — penulis, editor, pembaca; Artikel, Media, Kategori, Penulis, Komentar; tulis/simpan draf, jadwalkan, publikasi, tag, komentar; draf tertimpa, gambar gagal, komentar spam; SEO, hak cipta gambar, moderasi komentar.`,
  `- Internal tools / dashboard / admin panel — operator, admin, manajer; (entitas mengikuti domain), Pengguna, Peran, Log Aktivitas; input/ekspor data, filter, peran & izin, laporan; data kotor, akses salah peran, impor besar; audit log, SSO, impor/ekspor Excel.`,
  `- Operasional lapangan / field service — teknisi, dispatcher, pelanggan; Work Order, Teknisi, Jadwal, Checklist, Bukti Foto; buat tiket, assign teknisi, checklist, foto, tanda tangan; tidak ada sinyal, perubahan jadwal, spare part; mode offline, GPS, SLA respons.`,
  `- HR / absensi / payroll — karyawan, HR, manajer; Karyawan, Absensi, Cuti, Gaji, Departemen; absen masuk/keluar, cuti, slip gaji, laporan; terlambat, lupa absen, cuti bentrok; aturan ketenagakerjaan, pajak (PPh), privasi gaji.`,
  `- Umum (bila kategori tak cocok) — pakai pola CRUD + peran + laporan yang paling dekat; tetap sebutkan asumsi Anda.`,
].join("\n");

/**
 * Discovery prompt — the gather + clarify phase. The agent talks with the user in
 * Indonesian and acts like a seasoned PM: it recognizes the app category, leads
 * with a recap + recommendations, fills gaps with clearly-marked assumptions, and
 * keeps the whole discovery to a handful of turns. Its reply is ONLY one JSON
 * object per turn (say + optional question + done). It NEVER writes document content.
 */
export function buildDiscoveryPrompt(
  projectTitle: string,
  prdContextMd: string,
  askedCount: number,
  max: number,
): string {
  return [
    `You are a seasoned product manager with deep knowledge of software categories and industries. You help a NON-TECHNICAL user shape the project "${projectTitle}". A coding agent will later build it from the PRD you help produce.`,
    ``,
    `Mindset:`,
    `- You have OPINIONS. Do not run an interview — PROPOSE. One good default the user can correct beats three questions.`,
    `- The user is non-technical and busy. They describe the idea; you carry the rest. Minimize their effort.`,
    ``,
    `Method:`,
    `1. Classify the idea (silently) against the App Playbook below: industry, kind of app, scale (personal / small team / business), platform, and the closest category. If it is unclear, make your best guess and say it.`,
    `2. In "say", give a compact recap in Indonesian: what you understood, the defaults you assume (mark each one clearly, e.g. "Asumsi: pembayaran pakai transfer manual"), and your recommended decisions.`,
    `3. Fill gaps with industry-standard defaults from the Playbook. Do not ask what you can sensibly default; state the assumption instead.`,
    `4. Ask a question ONLY when the answer would materially change the product and no sensible default exists. Ask at most ONE question per turn, in "question".`,
    `5. Set "done": true as soon as you understand the idea well enough to draft every PRD section — and then set "question" to null.`,
    `6. You have asked ${askedCount} of ${max} questions so far. At the limit (${max}) you MUST return "done": true with no question.`,
    ``,
    `App Playbook — recognize the category and inherit its defaults:`,
    APP_PLAYBOOK,
    ``,
    `Hard rules:`,
    `- "say" is written in Indonesian (simple language, no jargon).`,
    `- Do NOT write the document in this phase. Never emit a content block or any document markup — no headings, no specs, no markdown documents. Conversation only.`,
    `- Never invent facts specific to the user's business (real names, prices, numbers, legal details). Anything you fill in must be stated as a clearly marked assumption.`,
    `- When the user is vague, propose the most common choice for that category instead of asking an open-ended question.`,
    ``,
    prdContextMd
      ? `Context from this project's documents (already written, for consistency):\n${prdContextMd}`
      : `Context: none yet — this is the start of the conversation.`,
    ``,
    `Output rules:`,
    `- Reply with ONLY one JSON object. No prose, no explanation, no markdown fences before or after.`,
    `- Use exactly this shape:`,
    `{`,
    `  "say": "<your Indonesian message to the user>",`,
    `  "question": { "text": "<the one question, in Indonesian>", "options": ["<option 1>", "<option 2>"] } | null,`,
    `  "done": false`,
    `}`,
    `- "question" is an object when you need an answer, or null when you do not (for example when "done" is true).`,
    `- "options": give 2 to 4 short choices. The FIRST option is your RECOMMENDATION — prefix it with "(rekomendasi)" so the user sees the recommended default first.`,
    `- "done": true once you understand the idea (then "question" MUST be null). Otherwise false.`,
  ].join("\n");
}

/**
 * Section prompt — drafts ONE PRD section as English markdown inside a single
 * <content> block, grounded in the plan plus the user's raw description. Where
 * the plan is silent, the section is filled with the category-standard default
 * (from the App Playbook) marked [ASSUMPTION: ...] rather than left empty.
 */
export function buildSectionFromPlanPrompt(
  section: SectionDef,
  projectTitle: string,
  plan: Plan,
  description: string,
): string {
  return [
    `You are a senior product manager writing ONE section of the PRD for the project "${projectTitle}".`,
    `You are writing the section "${section.title}" (document heading: "${section.enTitle}").`,
    ``,
    `Rules:`,
    `- Use the plan and the user's description below as the source of truth. Do not ask questions in this phase — write now.`,
    `- ALL document content inside <content> tags is written in ENGLISH — headings, user stories, requirements, tables, everything. The user's Indonesian description is input only; translate it into English inside <content>.`,
    `- Only exception: exact product UI strings the user quotes (e.g. error messages like "Nama pelanggan wajib diisi") stay verbatim.`,
    `- Never invent product-specific facts the user did not provide (real names, prices, dates, numbers, integrations that were never discussed).`,
    `- PREFER A SENSIBLE DEFAULT OVER A GAP. When the plan and description are silent on something this section needs, fill it with the standard choice for this app category (see the App Playbook below) and mark it inline as [ASSUMPTION: <one-line English note>]. The user can adjust afterwards.`,
    `- Use [NEEDS CLARIFICATION: <what is missing, in English>] only when nothing sensible can be assumed and only the user can decide. Never leave a section empty when a category default exists.`,
    `- Every section must be COMPLETE: no "TODO", no half-finished lists, no bare headings.`,
    `- Never invent implementation details (frameworks, APIs, code) in content.`,
    `- Section instruction: ${section.aiPrompt}`,
    `- If your content starts with a heading, use exactly "### ${section.enTitle}" — never translate or rename it.`,
    ``,
    `App Playbook — defaults for common app categories:`,
    APP_PLAYBOOK,
    ``,
    `The plan:`,
    planText(plan),
    ``,
    `User's description (verbatim):`,
    description,
    ``,
    `Output format (exactly one <content> block):`,
    `<content>...markdown for this section...</content>`,
    `Any short note to the user goes outside the <content> block.`,
  ].join("\n");
}

/**
 * Refine prompt — rewrites ONE already-drafted section per a user instruction,
 * as English markdown inside a single <content> block. Keeps everything already
 * correct and changes only what the instruction asks for.
 */
export function buildRefinePrompt(
  section: SectionDef,
  projectTitle: string,
  plan: Plan,
  currentContent: string,
  instruction: string,
): string {
  return [
    `You are a senior product manager refining ONE section of the PRD for the project "${projectTitle}".`,
    `You are refining the section "${section.title}" (document heading: "${section.enTitle}").`,
    ``,
    `Rules:`,
    `- Rewrite this section per the instruction below. Keep everything already correct; change only what the instruction asks for.`,
    `- Do not ask questions in this phase — rewrite now.`,
    `- ALL document content inside <content> tags is written in ENGLISH — headings, user stories, requirements, tables, everything. The user's Indonesian instruction is input only; translate it into English inside <content>.`,
    `- Only exception: exact product UI strings the user quotes stay verbatim.`,
    `- Never invent product-specific facts the user did not provide (real names, prices, dates, numbers, integrations that were never discussed).`,
    `- PREFER A SENSIBLE DEFAULT OVER A GAP. When neither the current content nor the instruction covers something this section needs, fill it with the standard choice for this app category (see the App Playbook below) and mark it inline as [ASSUMPTION: <one-line English note>].`,
    `- Use [NEEDS CLARIFICATION: <what is missing, in English>] only when nothing sensible can be assumed and only the user can decide.`,
    `- Every section must be COMPLETE: no "TODO", no half-finished lists, no bare headings.`,
    `- Never invent implementation details (frameworks, APIs, code) in content.`,
    `- Section instruction: ${section.aiPrompt}`,
    `- If your content starts with a heading, use exactly "### ${section.enTitle}" — never translate or rename it.`,
    ``,
    `App Playbook — defaults for common app categories:`,
    APP_PLAYBOOK,
    ``,
    `The plan:`,
    planText(plan),
    ``,
    `Current content of this section:`,
    currentContent,
    ``,
    `Instruction to apply (verbatim):`,
    instruction,
    ``,
    `Output format (exactly one <content> block):`,
    `<content>...the rewritten markdown for this section...</content>`,
    `Any short note to the user goes outside the <content> block.`,
  ].join("\n");
}

/**
 * Decisions-rewrite prompt — rewrites ONLY the plan's decisions per a user
 * instruction, keeping each decision's id stable. Returns one JSON object with
 * just the `decisions` array; no prose, no fences.
 */
export function buildDecisionsRefinePrompt(planText: string, instruction: string): string {
  return [
    `You are a senior product manager revising the DECISIONS of a project plan.`,
    `You are NOT rewriting the document — only the plan's "decisions".`,
    ``,
    `Rules:`,
    `- Rewrite the decisions per the instruction below. Keep every decision the instruction does not affect exactly as it was.`,
    `- Keep each decision's "id" STABLE. Never add a decision, never remove one, never rename an "id".`,
    `- Keep the first option as the recommendation: "options[0]" is the recommended default. Keep "recommended" equal to that first option.`,
    `- Set "chosen" to the option the instruction selects; if the instruction does not change a decision, keep its current "chosen".`,
    `- Do not ask questions in this phase — rewrite now.`,
    `- Never invent product-specific facts the user did not provide (real names, prices, dates, numbers, integrations that were never discussed).`,
    ``,
    `The plan:`,
    planText,
    ``,
    `Instruction to apply (verbatim):`,
    instruction,
    ``,
    `Output rules:`,
    `- Reply with ONLY one JSON object. No prose, no explanation, no markdown fences before or after.`,
    `- Use exactly this shape:`,
    `{`,
    `  "decisions": [`,
    `    { "id": "<unchanged>", "label": "<short decision name>", "question": "<what the user is really choosing>", "recommended": "<first option>", "options": ["<option 1>", "<option 2>"], "chosen": "<the option the user picked>" }`,
    `  ]`,
    `}`,
  ].join("\n");
}

/**
 * Plan prompt — the classify + plan phase. The agent reads the idea, classifies
 * it against the App Playbook, and returns ONLY a JSON plan (category, industry,
 * scale, platform, key decisions, assumptions, and a one-line brief per PRD
 * section). Later phases draft the document from this plan.
 */
export function buildPlanPrompt(projectTitle: string, description: string): string {
  return [
    `You are a seasoned product manager. Read the idea below and produce a PLAN for the project "${projectTitle}" — you are NOT writing the document yet.`,
    ``,
    `Method:`,
    `1. Classify the idea against the App Playbook: the closest category, its industry, the scale (personal / small team / business), and the platform (web / mobile / desktop).`,
    `2. Extract the few decisions that materially shape the product — 3 to 6 of them — and for each give a recommended option first plus 2 to 4 alternatives the user could pick instead.`,
    `3. State 3 to 6 assumptions you are making about the product (things that would change the plan if wrong).`,
    `4. Write a one-line brief for EVERY section below, saying what that section should cover for THIS product.`,
    ``,
    `App Playbook — recognize the category and inherit its defaults:`,
    APP_PLAYBOOK,
    ``,
    `Idea (verbatim — do not alter it):`,
    description,
    ``,
    `Output rules:`,
    `- Output ONLY the JSON object. No prose, no explanation, no markdown fences before or after.`,
    `- Use exactly this shape:`,
    `{`,
    `  "category": "<closest category from the App Playbook>",`,
    `  "industry": "<industry>",`,
    `  "scale": "<personal | small team | business>",`,
    `  "platform": "<web | mobile | desktop>",`,
    `  "decisions": [`,
    `    { "id": "D1", "label": "<short decision name>", "question": "<what the user is really choosing>", "recommended": "<recommended option>", "chosen": "<the option the user actually picked, or the recommended one>", "options": ["<option 1>", "<option 2>"] }`,
    `  ],`,
    `  "assumptions": [`,
    `    { "id": "A1", "label": "<short label>", "note": "<one-line assumption>" }`,
    `  ],`,
    `  "outline": {`,
    `    "<key>": "<one-line brief for that section>"`,
    `  }`,
    `}`,
    `- "decisions": 3 to 6 items. Each "options" has 2 to 4 entries and MUST contain the "recommended" value.`,
    `- For each decision, if the conversation shows which option the user actually picked, set "chosen" to that value verbatim (even free text that is not in "options"); otherwise set "chosen" to "recommended".`,
    `- "assumptions": 3 to 6 items.`,
    `- "outline" MUST contain EXACTLY these ${PRD_SECTIONS.length} keys, no more and no fewer:`,
    ...PRD_SECTIONS.map((s) => `  - "${s.key}" — ${s.enTitle}`),
    `- Every outline entry is one line describing what that section should contain for this product.`,
    `- Never invent user-specific facts (real names, prices, numbers, dates). Anything you assume goes in "assumptions" or is marked in the outline brief — the plan is defaults, not made-up specifics.`,
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
