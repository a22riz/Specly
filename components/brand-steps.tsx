"use client";

import { useState } from "react";

const STEPS = [
  {
    label: "Brand",
    short: "Kepribadian produkmu",
    narration:
      "Tentukan kepribadian, pesan utama, dan arah visual — AI bertanya lewat ngobrol biasa: \"produkmu mau terkesan ramah atau profesional?\"",
  },
  {
    label: "Design",
    short: "Tampilan & alur layar",
    narration:
      "Warna, ukuran huruf, komponen, susunan halaman, sampai kondisi kosong/gagal — semua tersusun jadi panduan tampilan yang konsisten.",
  },
  {
    label: "PRD",
    short: "Kebutuhan fitur",
    narration:
      "Daftar kemampuan wajib, contoh nyata, batasan teknis, dan definisi selesai — dokumen siap diberikan ke AI coding agent.",
  },
];

/** Interactive step chips for the auth brand panel — click to read each stage. */
export function BrandSteps() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <div>
      <div className="flex items-center gap-2" role="tablist" aria-label="Tahapan menyusun dokumen">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
              i === active ? "bg-white text-primary" : "bg-white/15 text-white/90 hover:bg-white/25"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>
      <div
        key={active}
        className="animate-pop-in mt-3 rounded-xl bg-white/10 px-4 py-3"
        role="tabpanel"
      >
        <p className="text-sm font-semibold text-white">{step.short}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/85">{step.narration}</p>
      </div>
    </div>
  );
}
