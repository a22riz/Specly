# Specly

Web app untuk menyusun **PRD (Product Requirements Document)** — dibantu AI, dirancang untuk pengguna non-IT. Kamu menceritakan idemu, menjawab beberapa pertanyaan singkat, lalu Specly menyusun dokumennya. Hasilnya file Markdown siap diberikan ke AI coding agent mana pun (Claude Code, Cursor, Copilot, dll).

Fokus Specly sekarang **PRD saja**. Tidak ada lagi pack Design atau Brand — satu proyek, satu PRD, satu percakapan.

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
4. **Ceritakan idemu** — tulis deskripsi singkat produkmu, lalu jawab beberapa pertanyaan singkat (tiap pertanyaan punya saran bawaan). Setelah itu AI menyusun rencananya (kategori aplikasi, beberapa keputusan penting, dan asumsi), jadi kamu tidak harus tahu harus menulis apa. Diskusi tersimpan — **satu percakapan per proyek**, bisa dilanjut kapan saja.
5. **PRD tersusun otomatis** — 12 bagian PRD (bahasa Inggris) ditulis paralel dari rencana + deskripsimu; hal yang diasumsikan ditandai `[ASSUMPTION: …]` alih-alih dikarang. Panel *Perlu keputusan* menampilkan pilihan yang membentuk produk beserta rekomendasinya (tanpa diubah di situ). Setiap bagian bisa kamu sunting langsung, dan satu bagian bisa disempurnakan lagi dengan instruksi singkat.
6. **Unduh** — `PRD.md` saja, atau semuanya sebagai ZIP.
7. **Beri ke AI coding agent** — cara lengkapnya ada di dialog *Cara pakai hasilnya* di editor. ZIP berisi `PRD.md` (dokumennya), `AGENTS.md` (aturan kerja yang dibaca otomatis oleh agent), dan `CARA_PAKAI.md` (panduan bahasa Indonesia untukmu). Dokumen berbahasa Inggris karena paling baik dipahami semua coding agent.

## Isi PRD (12 bagian)

| Section | Untuk apa |
|---|---|
| Ringkasan Masalah | Masalah, siapa penggunanya, kenapa penting sekarang |
| Tujuan & Non-Tujuan | Sasaran produk, dan apa yang sengaja tidak dikerjakan |
| Cerita Pengguna | Skenario "sebagai [peran], saya ingin [tujuan]" + kriteria Gherkin |
| Skenario Penerimaan | Skenario uji per fitur: kondisi awal, aksi, hasil yang diharapkan |
| Kebutuhan Fungsional | Kemampuan wajib, bernomor (FR-1, FR-2, …) |
| Entitas Utama | Hal penting yang harus diingat aplikasi dan atributnya |
| Kasus Khusus | Situasi tak biasa: data kosong, gagal, batas maksimal |
| Kebutuhan Non-Fungsional | Performa, keamanan, aksesibilitas, platform |
| Batasan & Asumsi | Batas keras (stack, deploy, perangkat) dan asumsi |
| Glosarium | Istilah khusus yang dipakai di dokumen ini beserta artinya |
| Kriteria Keberhasilan | Ukuran keberhasilan yang terukur |
| Definisi Selesai & Urutan Build | Checklist verifiable + urutan pengerjaan yang disarankan |

Semua bagian tersusun otomatis dari deskripsimu; hal yang belum pasti diisi default kategori atau ditandai `[ASSUMPTION: …]` untuk kamu cek.

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
| Isi PRD meleset / kurang | Sunting langsung bagiannya, atau pakai kolom perbaikan untuk minta AI menulis ulang satu bagian. Untuk menulis ulang semuanya, klik *Buat ulang* di panel keputusan |

## Struktur (untuk developer & AI agent)

- `lib/prompts.ts` — **sumber kebenaran tunggal**: definisi pack/section (`PACKS`) + semua system prompt (`buildDiscoveryPrompt`, `buildPlanPrompt`, `buildSectionFromPlanPrompt`, `buildRefinePrompt`, konteks `buildPrdContext`). Menambah bagian PRD = menambah entri di `PRD_SECTIONS`, tanpa migrasi DB.
- `lib/prd.ts` — helper alur PRD: ambil blok `<content>` dari balasan AI, rangkai transkrip percakapan, tentukan bagian mana yang perlu ditulis.
- `lib/discovery.ts` — kontrak diskusi: tipe `DiscoveryTurn`, `DISCOVERY_MAX`, `canAskMore`, dan `parseDiscoveryTurn` (parser JSON toleran; balasan prosa tetap jadi turn yang aman) (`tests/discovery.test.mjs`).
- `lib/estimate.ts` — perkiraan sisa waktu penulisan PRD untuk baris progres (`tests/estimate.test.mjs`).
- `lib/db.ts` — SQLite (better-sqlite3): users, proyek (per user, plus flag `discovery_done`), section (`key` bebas, `content_md`), **messages** (satu percakapan per proyek), konfigurasi AI (per user, API key terenkripsi).
- `lib/auth-crypto.ts` — crypto murni (node:crypto, tanpa dependensi): hash password scrypt, token sesi HMAC, enkripsi AES-256-GCM untuk API key (`tests/auth.test.mjs`).
- `lib/auth.ts` — sesi cookie (httpOnly, same-site lax) + guard halaman `requireUser()`. Secret dari env `SPECLY_SECRET`, fallback otomatis `data/secret.key`.
- `lib/render.ts` — merakit section menjadi `PRD.md`, menyusun `AGENTS.md` untuk coding agent, dan menyimpan panduan `CARA_PAKAI.md` (`tests/render.test.mjs`).
- `lib/sse.ts` — parser SSE untuk streaming `app/api/prd` (`tests/sse.test.mjs`).
- `app/api/discovery` — streaming diskusi ke endpoint OpenAI-compatible (tiap giliran satu JSON: `say`, `question`, `done`); tiap giliran disimpan ke tabel `messages`.
- `app/api/prd` — menyusun *plan* lalu menulis 12 bagian PRD secara paralel dari percakapan, menyimpan tiap bagian. Diblokir (409) selama diskusi belum selesai, kecuali diminta menimpa dengan `force`.
- `app/api/prd/refine` — menyempurnakan satu bagian PRD dari instruksi singkatmu.
- `app/api/export` — unduh `PRD.md` saja atau ZIP lengkap (`PRD.md`, `AGENTS.md`, `CARA_PAKAI.md`); tidak ada yang dicache ke disk.
- `design-system/specly/MASTER.md` — acuan desain UI.

Konvensi penting:

- **Multi-user internal (BYOK)**: semua query proyek/konfigurasi di-scope ke user sesi; API key user dienkripsi at rest (AES-256-GCM); key dikembalikan hanya ke sesi pemiliknya.
- Percakapan dengan AI berbahasa Indonesia; **isi dokumen selalu bahasa Inggris** (di dalam blok `<content>`) — agent coding non-Indonesia tetap paham. String UI produk yang dikutip user dibiarkan apa adanya.
- AI tidak boleh mengarang detail implementasi (framework/API) di konten PRD; hal yang belum diketahui diisi default kategori dan ditandai `[ASSUMPTION: …]`, atau `[NEEDS CLARIFICATION: …]` bila hanya kamu yang bisa memutuskan.
- Percakapan disimpan sebagai riwayat per proyek (tabel `messages`); Specly hanya menyimpan isi section final, percakapan, dan flag `discovery_done` per proyek, bukan state lain.
- Test: `node --experimental-strip-types tests/<nama>.test.mjs` — `auth`, `db-messages`, `prd`, `prompts`, `render`, `sse`, `plan`, `db-plan`, `concurrency`, `discovery`, `db-discovery`, `estimate`.

Dokumen untuk AI agent yang mengembangkan Specly: lihat `AGENTS.md`.
