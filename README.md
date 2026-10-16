# Specly

Web app untuk menyusun **PRD + Design Pack + Brand Pack** — dibantu AI, dirancang untuk pengguna non-IT. Hasilnya file Markdown siap diberikan ke AI coding agent mana pun (Claude Code, Cursor, Copilot, dll).

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

Data tersimpan di SQLite lokal: `data/prd.sqlite` (ubah lewat `PRD_DB_PATH`). Tidak perlu instalasi database apa pun — semuanya satu file.

## Deploy produksi (Docker + Cloudflare Tunnel)

```sh
cp .env.example .env                     # lalu isi SPECLY_SECRET (openssl rand -hex 32)
docker compose up -d --build             # build + jalankan; app di localhost:3000 saja
```

- App hanya terikat `127.0.0.1:3000` — tidak terbuka ke internet. Pasang **Cloudflare Tunnel** (`cloudflared`) di server, arahkan service ke `http://localhost:3000`; HTTPS datang dari Cloudflare.
- Data user tersimpan di Docker volume `specly-data` — aman saat rebuild. Backup: `docker compose exec app cat /app/data/prd.sqlite > backup.sqlite` (saat aplikasi idle).
- Update aplikasi: `git pull && docker compose up -d --build`.

## Cara pakai

1. **Daftar & masuk** — buat akun dengan email + password. Pendaftar **pertama otomatis jadi admin**; pendaftar berikutnya menunggu **persetujuan admin** (tanpa kirim email — admin menyetujui di dashboard *Kelola User*). Setiap akun punya proyek dan pengaturannya sendiri; satu tim berbagi satu instalasi Specly, data antar akun terpisah.
2. **Atur AI** — tombol *Pengaturan AI*, isi Base URL, API key, dan nama model. Ini skema **BYOK (Bring Your Own Key)**: API key-mu milikmu, tersimpan terenkripsi di database, dan hanya dipakai untuk panggilan AI-mu sendiri. Endpoint apa pun yang kompatibel API OpenAI bisa dipakai (OpenAI, Ollama, Groq, OpenRouter, vLLM, …).
3. **Buat proyek** — beri nama produk/aplikasimu.
4. **Isi 3 pack** dengan urutan PRD → Brand → Design. Ngobrol dengan AI di panel chat, atau tulis sendiri lalu tekan *Rapikan dengan AI*. Simpan per bagian.
5. **Logo** (opsional) — di tab *Brand Pack*, klik **Generate Logo**. AI membuat logo SVG dari arah brand-mu. Bisa:
   - **Regenerate** — minta variasi baru dari awal.
   - **Revisi dengan AI** — tulis masukanmu (misal: "warnanya hijau tua, teks kegedean"), AI memperbaiki logo yang ada tanpa mengubah bagian yang sudah bagus. Bisa diulang berkali-kali.
   - **Edit SVG** — sunting kodenya langsung, untuk yang paham SVG.
   - **Unduh .svg** — simpan sebagai `LOGO.svg`.
6. **Unduh** — `PRD.md`, `DESIGN_PACK.md`, `BRAND_PACK.md`, `LOGO.svg`, atau semuanya sebagai ZIP.
7. **Beri ke AI coding agent** — cara lengkapnya ada di dialog *Cara pakai hasilnya* di editor. ZIP berisi `AGENTS.md` (dibaca otomatis oleh agent) dan `CARA_PAKAI.md` (panduan bahasa Indonesia untukmu). Dokumen berbahasa Inggris karena paling baik dipahami semua coding agent.

## Isi PRD Pack

| Section | Untuk apa |
|---|---|
| Pendahuluan | Masalah, siapa yang terlibat, kamus istilah (glossary) |
| Tujuan & Non-Tujuan | Sasaran produk, dan apa yang sengaja tidak dikerjakan |
| Cerita Pengguna | Skenario "sebagai [peran], saya ingin [tujuan]" + kriteria terima Gherkin |
| Kebutuhan Fungsional | Kemampuan wajib, bernomor (FR-1, FR-2, …) |
| Contoh Penggunaan | Contoh input/output nyata per fitur utama — pendeteksi miskomunikasi paling ampuh |
| Kebutuhan Non-Fungsional | Performa, keamanan, aksesibilitas, platform |
| Batasan Teknis | Stack wajib/dilarang, platform target, batas deploy — batas keras untuk AI agent |
| Kriteria Keberhasilan | Ukuran keberhasilan yang terukur |
| Definisi Selesai | Checklist verifiable sebelum fitur dianggap selesai |
| Catatan & Jebakan | Hal yang harus dihindari, dari percakapanmu |

Semua section diisi lewat ngobrol — AI bertanya dulu kalau masih ada kekurangan, jadi kamu tidak harus tahu harus menulis apa.

## Backup & pindah komputer

Seluruh data Specly = folder `data/`. Backup atau pindah laptop? Copy foldernya. Tidak ada langkah lain.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| "AI belum dikonfigurasi" | Isi Base URL + API key + model di *Pengaturan AI* |
| "Akun belum diverifikasi" | Tunggu admin menyetujui di dashboard *Kelola User* |
| Lupa password admin | Hapus baris user di `data/prd.sqlite`, daftar ulang — user pertama / satu-satunya otomatis jadi admin lagi |
| Port 3000 terpakai | `PORT=3001 npm run dev` |
| Ingin data di tempat lain | `PRD_DB_PATH=/path/ke/specly.sqlite npm run dev` |
| Deploy (secret tidak di disk) | Set env `SPECLY_SECRET` (string acak) — dipakai untuk sesi & enkripsi key |
| Logo hasil aneh | Klik *Regenerate*, atau pakai *Revisi dengan AI* dengan masukan yang spesifik |

## Struktur (untuk developer & AI agent)

- `lib/prompts.ts` — **sumber kebenaran tunggal**: definisi pack/section + semua system prompt AI (editor, chat, logo, revisi logo). Menambah section = menambah entri di sini, tanpa migrasi DB.
- `lib/db.ts` — SQLite (better-sqlite3): users, proyek (per user), section (key bebas, tanpa skema per section), konfigurasi AI (per user, API key terenkripsi).
- `lib/auth-crypto.ts` — crypto murni (node:crypto, tanpa dependensi): hash password scrypt, token sesi HMAC, enkripsi AES-256-GCM untuk API key (`tests/auth.test.mjs` mengujinya).
- `lib/auth.ts` — sesi cookie (httpOnly, sama-site lax) + guard halaman `requireUser()`. Secret dari env `SPECLY_SECRET`, fallback otomatis `data/secret.key`.
- `lib/render.ts` — merakit section menjadi dokumen Markdown (`tests/render.test.mjs` mengujinya).
- `app/api/chat` — streaming chat ke endpoint OpenAI-compatible (Chat Completions).
- `app/api/logo` — generate & revisi logo SVG via LLM (streaming, same transport; sanitasi SVG dasar di server).
- `app/api/export` — unduh MD per pack atau ZIP lengkap (termasuk `LOGO.svg` bila ada).
- `components/logo-card.tsx` — UI logo: preview, regenerate, revisi via masukan teks, edit SVG manual, unduh.
- `design-system/specly/MASTER.md` — acuan desain UI.

Konvensi penting:

- **Multi-user internal (BYOK)**: semua query proyek/konfigurasi di-scope ke user sesi; API key user dienkripsi at rest (AES-256-GCM); key dikembalikan hanya ke sesi pemiliknya.
- Percakapan dengan AI berbahasa Indonesia; **isi dokumen selalu bahasa Inggris** (di dalam blok `<content>`) — agent coding non-Indonesia tetap paham. String UI produk yang dikutip user dibiarkan apa adanya.
- AI tidak boleh mengarang detail implementasi (framework/API) di konten PRD.
- Percakapan tidak disimpan di server — hanya isi section final yang tersimpan.
- Test: `node --experimental-strip-types tests/render.test.mjs && node --experimental-strip-types tests/auth.test.mjs`

Dokumen untuk AI agent yang mengembangkan Specly: lihat `AGENTS.md`.
