# Specly

Web app untuk menyusun **PRD (Product Requirements Document)** — dibantu AI, dirancang untuk pengguna non-IT. Kamu menceritakan idemu, menjawab beberapa pertanyaan singkat, lalu Specly menyusun dokumennya. Hasilnya file Markdown siap diberikan ke AI coding agent mana pun (Claude Code, Cursor, Copilot, dll).

Fokus Specly **PRD saja**: satu proyek, satu PRD, satu percakapan. Berjalan lokal, data di SQLite, AI pakai **BYOK** (API key milikmu sendiri).

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

## Cara pakai

1. **Daftar & masuk** — buat akun dengan email + password. Pendaftar **pertama otomatis jadi admin**; pendaftar berikutnya menunggu **persetujuan admin** (tanpa kirim email — admin menyetujui di dashboard *Kelola User*). Setiap akun punya proyek dan pengaturannya sendiri.
2. **Atur AI** — tombol *Pengaturan AI*, isi Base URL, API key, dan nama model. Ini skema **BYOK**: API key tersimpan terenkripsi dan hanya dipakai untuk panggilan AI-mu sendiri. Endpoint apa pun yang kompatibel API OpenAI bisa dipakai (OpenAI, Ollama, Groq, OpenRouter, vLLM, …).
3. **Buat proyek** — beri nama produk/aplikasimu.
4. **Ceritakan idemu** — tulis deskripsi singkat, lalu jawab beberapa pertanyaan singkat (tiap pertanyaan punya saran bawaan). AI lalu menyusun rencananya (kategori, beberapa keputusan penting, dan asumsi). Diskusi tersimpan — **satu percakapan per proyek**.
5. **Tinjau & sunting** — panel *Perlu keputusan* menampilkan pilihan yang membentuk produk; kamu bisa mengubahnya langsung, atau minta AI menulis ulang. Setiap bagian PRD bisa disunting langsung atau disempurnakan dengan instruksi singkat.
6. **Unduh** — `PRD.md` saja, `AGENTS.md` saja, atau semuanya sebagai ZIP.
7. **Beri ke AI coding agent** — ZIP berisi `PRD.md` (dokumennya), `AGENTS.md` (aturan kerja yang dibaca otomatis oleh agent), dan `CARA_PAKAI.md` (panduan bahasa Indonesia untukmu). Dokumen berbahasa Inggris karena paling baik dipahami semua coding agent.

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

## Deploy produksi

Dua jalur: **Docker Compose** (satu host) atau **Kubernetes**. Langkah lengkap di [docs/deployment.md](docs/deployment.md); manifest K8s di [`deploy/k8s/`](deploy/k8s/).

```sh
cp .env.example .env                     # lalu isi SPECLY_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

App hanya terikat `127.0.0.1:3000`; HTTPS datang dari Cloudflare Tunnel. Data di volume `specly-data` — aman saat rebuild. Di Kubernetes jalankan **satu replika** (SQLite satu penulis) di volume `ReadWriteOnce`.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| "AI belum dikonfigurasi" | Isi Base URL + API key + model di *Pengaturan AI* |
| "Akun belum diverifikasi" | Tunggu admin menyetujui di dashboard *Kelola User* |
| Lupa password admin | Hapus baris user di `data/prd.sqlite`, daftar ulang — user pertama otomatis jadi admin lagi |
| Port 3000 terpakai | `PORT=3001 npm run dev` |
| Ingin data di tempat lain | `PRD_DB_PATH=/path/ke/specly.sqlite npm run dev` |
| Isi PRD meleset / kurang | Sunting langsung bagiannya, atau pakai kolom perbaikan untuk minta AI menulis ulang satu bagian. Untuk menulis ulang semuanya, klik *Buat ulang* |
| Backup / pindah komputer | Seluruh data Specly = folder `data/`. Copy foldernya. |

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/index.md](docs/index.md) | Daftar isi dokumentasi |
| [docs/architecture.md](docs/architecture.md) | Cara kerja: stack, alur, peta modul, model data, konvensi |
| [docs/development.md](docs/development.md) | Setup, skrip, test, dan cara mengembangkan |
| [docs/deployment.md](docs/deployment.md) | Docker, Cloudflare Tunnel, env, backup, update |
| [design-system/specly/MASTER.md](design-system/specly/MASTER.md) | Acuan desain UI |
| [AGENTS.md](AGENTS.md) | Aturan untuk AI coding agent yang mengembangkan repo ini |
