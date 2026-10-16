import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { getSessionUser } from "@/lib/auth";

export const instant = false;

const POINTS = [
  "Pendaftar pertama otomatis jadi admin tim",
  "Setiap anggota punya proyek & pengaturannya sendiri",
  "API key milikmu — terenkripsi, tidak dibagikan",
];

export default async function DaftarPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="animate-fade-up mx-auto grid w-full max-w-4xl flex-1 items-stretch gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2">
      {/* Brand panel — fills the left half on desktop */}
      <section
        aria-hidden="true"
        className="hidden flex-col justify-between rounded-2xl bg-gradient-to-br from-primary to-secondary p-8 text-white lg:flex"
      >
        <div>
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true">
              <rect width="24" height="24" rx="6" className="fill-white" />
              <path
                d="M15.5 8.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.4 7 2 7 5 0 1.7-1.5 2.8-3.7 2.8-1.8 0-3.2-.7-3.8-1.9"
                className="stroke-primary"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="font-heading text-xl font-bold tracking-tight">Specly</span>
          </span>
          <h1 className="mt-10 font-heading text-3xl font-bold leading-snug">
            Satu tim, satu Specly.
          </h1>
          <p className="mt-3 text-white/80">
            Kumpulkan kebutuhan produk timmu dalam bahasa sehari-hari, serahkan sisanya ke AI.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-white/90">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            Admin menyetujui anggota baru — tanpa email bolak-balik
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Data per akun, tersimpan lokal di server tim
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
              <rect width="24" height="24" rx="6" fill="#2563eb" />
              <path
                d="M15.5 8.2c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.4 7 2 7 5 0 1.7-1.5 2.8-3.7 2.8-1.8 0-3.2-.7-3.8-1.9"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="font-heading text-lg font-bold tracking-tight">Specly</span>
          </div>
          <h2 className="font-heading text-xl font-bold">Buat akun Specly</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Gratis untuk tim internal. Menunggu persetujuan admin sebelum aktif.
          </p>
          <AuthForm mode="daftar" />
        </div>
      </section>
    </main>
  );
}
