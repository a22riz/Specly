# PRD

Web app untuk menyusun PRD + Design Pack + Brand Pack — dibantu AI, dirancang untuk pengguna non-IT. Hasilnya file Markdown siap diberikan ke AI coding agent mana pun (Claude Code, Cursor, Copilot, dll).

## Menjalankan

```sh
npm install
npm run dev        # buka http://localhost:3000
```

Produksi:

```sh
npm run build
npm run start
```

Data tersimpan di SQLite lokal: `data/prd.sqlite` (ubah lewat `PRD_DB_PATH`).

## Cara pakai

1. **Atur AI** — tombol *Pengaturan AI*, isi Base URL, API key, dan nama model. Endpoint apa pun yang kompatibel API OpenAI bisa dipakai (OpenAI, Ollama, Groq, OpenRouter, vLLM, …).
2. **Buat proyek** — beri nama produk/aplikasimu.
3. **Isi 3 pack** dengan urutan Brand → Design → PRD. Ngobrol dengan AI di panel chat, atau tulis sendiri lalu tekan *Rapikan dengan AI*. Simpan per bagian.
4. **Unduh** — `PRD.md`, `DESIGN_PACK.md`, `BRAND_PACK.md`, atau semuanya sebagai ZIP.

## Struktur

- `lib/prompts.ts` — definisi pack/section + system prompt AI (satu sumber untuk editor, chat, dan render)
- `lib/db.ts` — SQLite (better-sqlite3): proyek, bagian, konfigurasi AI
- `lib/render.ts` — menyusun bagian menjadi dokumen Markdown (`tests/render.test.mjs` mengujinya)
- `app/api/chat` — streaming chat ke endpoint OpenAI-compatible (Chat Completions)
- `app/api/export` — unduh MD per pack atau ZIP lengkap

Desain UI mengikuti `design-system/specly/MASTER.md`.

Percakapan dengan AI tidak disimpan di server — hanya isi bagian final yang tersimpan.
